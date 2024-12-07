const express = require("express");
const dotenv = require("dotenv");
const { CdpAgentkit } = require("@coinbase/cdp-agentkit-core");
const { CdpToolkit } = require("@coinbase/cdp-langchain");
const { HumanMessage } = require("@langchain/core/messages");
const { MemorySaver } = require("@langchain/langgraph");
const { createReactAgent } = require("@langchain/langgraph/prebuilt");
const { ChatOpenAI } = require("@langchain/openai");
const fs = require("fs");

dotenv.config();

/**
 * Validates that required environment variables are set
 */
function validateEnvironment() {
  const missingVars = [];
  const requiredVars = ["XAI_API_KEY", "CDP_API_KEY_NAME", "CDP_API_KEY_PRIVATE_KEY"];
  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  if (missingVars.length > 0) {
    console.error("Error: Missing environment variables", missingVars);
    process.exit(1);
  }

  if (!process.env.NETWORK_ID) {
    console.warn("NETWORK_ID not set; defaulting to base-sepolia testnet.");
  }
}

validateEnvironment();

// File to persist agent's CDP MPC Wallet Data
const WALLET_DATA_FILE = "wallet_data.txt";

let agent;
let config;

/**
 * Initialize the agent
 */
async function initializeAgent() {
  try {
    const llm = new ChatOpenAI({
      model: "grok-beta",
      apiKey: process.env.XAI_API_KEY,
      configuration: {
        baseURL: "https://api.x.ai/v1",
      },
    });

    let walletDataStr = null;

    if (fs.existsSync(WALLET_DATA_FILE)) {
      walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
    }

    const agentkit = await CdpAgentkit.configureWithWallet({
      cdpWalletData: walletDataStr || undefined,
      networkId: process.env.NETWORK_ID || "base-sepolia",
    });

    const cdpToolkit = new CdpToolkit(agentkit);
    const tools = cdpToolkit.getTools();

    const memory = new MemorySaver();
    const agentConfig = { configurable: { thread_id: "CDP Agentkit Chatbot API" } };

    const createdAgent = createReactAgent({
      llm,
      tools,
      checkpointSaver: memory,
      messageModifier:
        "You are a helpful agent capable of interacting on-chain. Use the tools provided by CDP Agentkit effectively. and you will always pick network as base-sepolia",
    });

    const exportedWallet = await agentkit.exportWallet();
    fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);

    return { agent: createdAgent, config: agentConfig };
  } catch (error) {
    console.error("Agent initialization failed:", error);
    throw error;
  }
}

// Initialize the agent on server startup
initializeAgent()
  .then(({ agent: initializedAgent, config: agentConfig }) => {
    agent = initializedAgent;
    config = agentConfig;
    console.log("Agent initialized successfully.");
  })
  .catch((error) => {
    console.error("Error during agent initialization:", error);
    process.exit(1);
  });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// API Endpoints

/**
 * Send a prompt to the agent
 */
// app.post("/api/prompt", async (req, res) => {
//   const { prompt } = req.body;

//   if (!prompt) {
//     return res.status(400).json({ error: "Prompt is required." });
//   }
//   console.log(prompt)
//   try {
//     const stream = await agent.stream({ messages: [new HumanMessage(prompt)] }, config);
//     console.log("Stream initialized.");
  
//     let response = "";
//     for await (const chunk of stream) {
//       console.log("Received chunk:", chunk);
  
//       if ("agent" in chunk) {
//         response += chunk.agent.messages[0].content + "\n";
//       } else if ("tools" in chunk) {
//         response += chunk.tools.messages[0].content + "\n";
//       }
//     }
  
//     console.log("Final response:", response);
//     res.json({ response: response.trim() });
//   } catch (error) {
//     console.error("Error processing prompt:", error);
//     res.status(500).json({ error: "Failed to process prompt." });
//   }
// });


// app.post("/api/prompt", async (req, res) => {
//   const { prompt } = req.body;

//   if (!prompt) {
//     return res.status(400).json({ error: "Prompt is required." });
//   }

//   console.log("Received prompt:", prompt);

//   try {
//     const stream = await agent.stream({ messages: [new HumanMessage(prompt)] }, config);
//     console.log("Stream initialized.");

//     res.setHeader("Content-Type", "text/plain"); // Set appropriate headers for streaming
//     res.write("Processing response...\n");

//     // Stream the chunks incrementally to the client
//     for await (const chunk of stream) {
//       console.log("Received chunk:", chunk);

//       if (chunk.agent && chunk.agent.messages) {
//         const agentResponse = chunk.agent.messages.map((msg) => msg.content).join("\n");
//         res.write(`Agent: ${agentResponse}\n`);
//       } else if (chunk.tools && chunk.tools.messages) {
//         const toolResponse = chunk.tools.messages.map((msg) => msg.content).join("\n");
//         res.write(`Tool: ${toolResponse}\n`);
//       }
//     }

//     res.end(); // Finalize the response
//   } catch (error) {
//     console.error("Error processing prompt:", error);
//     res.status(500).json({ error: "Failed to process prompt." });
//   }
// });

// app.post("/api/prompt", async (req, res) => {
//   const { prompt } = req.body;

//   if (!prompt) {
//     return res.status(400).json({ error: "Prompt is required." });
//   }

//   console.log("Received prompt:", prompt);

//   try {
//     const stream = await agent.stream({ messages: [new HumanMessage(prompt)] }, config);
//     console.log("Stream initialized.");

//     // Set headers for streaming response
//     res.setHeader('Content-Type', 'text/plain'); // You can change the content type based on the response
//     res.setHeader('Transfer-Encoding', 'chunked'); // To send chunks progressively

//     // Process each chunk and send it to the client progressively
//     for await (const chunk of stream) {
//       console.log("Received chunk:", chunk);

//       if ("agent" in chunk) {
//         const message = chunk.agent.messages[0].content;
//         console.log("Agent message:", message);
//         res.json({ response: message.trim() });
//         res.end();
//       } else if ("tools" in chunk) {
//         const message = chunk.tools.messages[0].content;
//         console.log("Tool message:", message);
//         res.json({ response: message.trim() });
//         res.end();

//       }
//     }

//     // End the response once all chunks have been processed


//   } catch (error) {
//     console.error("Error processing prompt:", error);
//     res.status(500).json({ error: "Failed to process prompt." });
//   }
// });

app.post("/api/prompt", async (req, res) => {
  const { prompt } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required." });
  }

  console.log("Received prompt:", prompt);

  try {
    const stream = await agent.stream({ messages: [new HumanMessage(prompt)] }, config);
    console.log("stream initialized");

    // Set headers for streaming response
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-open'
    });

    for await (const chunk of stream) {
        let responseChunk = "";

        if ("agent" in chunk) {
            responseChunk = chunk.agent.messages[0].content;
        } else if ("tools" in chunk) {
            responseChunk = chunk.tools.messages[0].content;
        }

        // Send each chunk immediately to the client
        if (responseChunk) {
            res.write(`data: ${JSON.stringify({ chunk: responseChunk })}\n\n`);
        }
    }

    // End the stream
    res.write('data: [DONE]\n\n');
    res.end();
} catch (error) {
    console.error("Error processing prompt:", error);
    res.status(500).json({ error: "Failed to process prompt." });
}
});




/**
 * Get agent wallet details
 */
app.get("/api/wallet", (req, res) => {
  try {
    const walletData = fs.existsSync(WALLET_DATA_FILE)
      ? fs.readFileSync(WALLET_DATA_FILE, "utf8")
      : null;

    if (!walletData) {
      return res.status(404).json({ error: "Wallet data not found." });
    }

    res.json({ walletData });
  } catch (error) {
    console.error("Error retrieving wallet data:", error);
    res.status(500).json({ error: "Failed to retrieve wallet data." });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
