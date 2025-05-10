export interface Env {
	DEEPSEEK_API_KEY?: string;
}

// HTML 页面模板
const chatTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DeepSeek 聊天助手</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .chat-container {
      display: flex;
      flex-direction: column;
      height: 70vh;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      background-color: white;
    }
    .messages {
      flex-grow: 1;
      padding: 20px;
      overflow-y: auto;
    }
    .message {
      margin-bottom: 15px;
      padding: 10px 15px;
      border-radius: 18px;
      max-width: 80%;
      line-height: 1.4;
    }
    .user-message {
      background-color: #e1f5fe;
      align-self: flex-end;
      margin-left: auto;
    }
    .ai-message {
      background-color: #f1f1f1;
      align-self: flex-start;
    }
    .input-area {
      display: flex;
      padding: 15px;
      border-top: 1px solid #ddd;
      background-color: white;
    }
    #user-input {
      flex-grow: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 20px;
      margin-right: 10px;
    }
    button {
      padding: 10px 20px;
      background-color: #0288d1;
      color: white;
      border: none;
      border-radius: 20px;
      cursor: pointer;
    }
    button:hover {
      background-color: #0277bd;
    }
    .thinking {
      color: #888;
      font-style: italic;
    }
  </style>
</head>
<body>
  <h1>DeepSeek 聊天助手</h1>
  <div class="chat-container">
    <div class="messages" id="messages">
      <div class="message ai-message">
        你好！我是基于 DeepSeek 的 AI 助手。有什么我可以帮助你的吗？
      </div>
    </div>
    <div class="input-area">
      <input type="text" id="user-input" placeholder="输入你的问题...">
      <button id="send-btn">发送</button>
    </div>
  </div>

  <script>
    const messagesContainer = document.getElementById('messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-btn');

    function addMessage(text, isUser) {
      const messageDiv = document.createElement('div');
      messageDiv.className = isUser ? 'message user-message' : 'message ai-message';
      messageDiv.textContent = text;
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    async function sendMessage() {
      const message = userInput.value.trim();
      if (!message) return;
      
      addMessage(message, true);
      userInput.value = '';
      
      // 添加"正在思考"的提示
      const thinkingDiv = document.createElement('div');
      thinkingDiv.className = 'message ai-message thinking';
      thinkingDiv.textContent = '正在思考...';
      messagesContainer.appendChild(thinkingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ prompt: message }),
        });
        
        if (!response.ok) {
          throw new Error('API 请求失败');
        }
        
        const data = await response.json();
        
        // 移除"正在思考"的提示
        messagesContainer.removeChild(thinkingDiv);
        
        // 添加 AI 回复
        addMessage(data.reply, false);
      } catch (error) {
        console.error('Error:', error);
        // 移除"正在思考"的提示
        messagesContainer.removeChild(thinkingDiv);
        addMessage('抱歉，出现了错误，请重试。', false);
      }
    }

    sendButton.addEventListener('click', sendMessage);
    userInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  </script>
</body>
</html>
`;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// 添加 CORS 响应头
		const corsHeaders = {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization, Origin, Accept',
			'Access-Control-Max-Age': '86400',
		};

		// 处理 OPTIONS 预检请求
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: corsHeaders
			});
		}

		// 为所有响应添加 CORS 头
		const addCorsHeaders = (response: Response) => {
			const newHeaders = new Headers(response.headers);
			Object.entries(corsHeaders).forEach(([key, value]) => {
				newHeaders.set(key, value);
			});
			return new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: newHeaders,
			});
		};

		// 提供 HTML 页面
		if (url.pathname === "/" || url.pathname === "") {
			return new Response(chatTemplate, {
				headers: { "Content-Type": "text/html" },
			});
		}

		// 处理 API 请求
		if (url.pathname === "/api/chat" && request.method === "POST") {
			try {
				// 确保存在 API Key
				const apiKey = env.DEEPSEEK_API_KEY;
				if (!apiKey) {
					return addCorsHeaders(new Response(JSON.stringify({ error: "API key not configured" }), {
						status: 500,
						headers: { "Content-Type": "application/json" }
					}));
				}

				// 获取用户输入
				const { prompt } = await request.json();

				// 准备 DeepSeek API 请求
				const payload = {
					model: "deepseek-chat",
					messages: [
						{ role: "user", content: prompt }
					],
					temperature: 0.7,
					max_tokens: 1000
				};

				// 调用 DeepSeek API
				const deepseekResponse = await fetch("https://api.deepseek.com/v1/chat/completions", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"Authorization": `Bearer ${apiKey}`
					},
					body: JSON.stringify(payload)
				});

				if (!deepseekResponse.ok) {
					const errorText = await deepseekResponse.text();
					throw new Error(`DeepSeek API error: ${deepseekResponse.status} ${errorText}`);
				}

				const data = await deepseekResponse.json();

				// 返回 AI 的回复
				return addCorsHeaders(new Response(
					JSON.stringify({
						reply: data.choices[0].message.content
					}),
					{
						headers: { "Content-Type": "application/json" }
					}
				));
			} catch (error) {
				return addCorsHeaders(new Response(
					JSON.stringify({ error: error.message }),
					{
						status: 500,
						headers: { "Content-Type": "application/json" }
					}
				));
			}
		}

		// 处理其他路径
		return new Response("Not Found", { status: 404 });
	},
};
