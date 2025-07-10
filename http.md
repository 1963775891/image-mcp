即梦AI图像生成服务 - HTTP API 文档

  服务概述

  - 基础地址: http://localhost:3400 (默认端口)
  - 支持格式: JSON, Text/Plain, Multipart/Form-Data
  - 输出格式: Markdown 或纯文本
  - 支持的AI模型: jimeng-3.1, jimeng-3.0, jimeng-2.1, jimeng-2.0-pro, jimeng-2.0

  认证方式

  支持多种Token传递方式：
  1. Authorization Header: Bearer <token>
  2. LobeChat专用Header: x-lobe-plugin-settings
  3. 请求体中的settings字段
  4. 环境变量: JIMENG_API_TOKEN

  API 接口详情

  1. 通用图像生成接口

  接口地址: POST /api/generateImage

  功能: 兼容 Dify 和 LobeChat 的通用图像生成接口

  请求头:
  Content-Type: application/json
  Authorization: Bearer <your_token>

  请求体格式:

  格式1 - 直接调用:
  {
    "prompt": "一只可爱的猫咪",
    "model": "jimeng-3.1",
    "aspect_ratio": "16:9",
    "filePath": "data:image/png;base64,..."
  }

  格式2 - LobeChat格式:
  {
    "id": "123",
    "apiName": "generateImage",
    "arguments": {
      "prompt": "一只可爱的猫咪",
      "filePath": ""
    }
  }

  格式3 - Dify格式:
  {
    "arguments": "{\"prompt\":\"一只可爱的猫咪\",\"filePath\":\"\"}"
  }

  参数说明:
  - prompt (必填): 图像描述文本
  - model (可选): AI模型名称，默认 "jimeng-3.1"
  - aspect_ratio (可选): 图像比例，默认 "16:9"
  - filePath (可选): 参考图像的Base64数据

  支持的图像比例:
  - 1:1, 16:9, 4:3, 3:2, 21:9, 3:4, 2:3, 9:21, 9:16

  响应:
  - 成功: 返回 Markdown 格式的图像结果
  - 失败: 返回 JSON 错误信息

  2. Dify专用接口

  接口地址: POST /api/dify/generateImage

  功能: 专为 Dify 平台优化的图像生成接口

  请求头:
  Content-Type: application/json
  Authorization: Bearer <your_token>

  请求体:
  {
    "prompt": "一只可爱的猫咪",
    "model": "jimeng-3.1",
    "aspect_ratio": "16:9",
    "filePath": "data:image/png;base64,..."
  }

  特点:
  - 简化的参数结构
  - 支持 Markdown 格式输出
  - 专门的错误处理

  3. ComfyUI专用接口

  接口地址: POST /api/comfyui/generateImage

  功能: 专为 ComfyUI 平台设计的图像生成接口

  请求头:
  Content-Type: multipart/form-data
  Authorization: Bearer <your_token>

  请求体:
  prompt: "一只可爱的猫咪"
  model: "jimeng-3.1"
  aspect_ratio: "16:9"
  width: 1664
  height: 936
  image: [文件上传]
  init_image: [Base64字符串]

  特点:
  - 支持文件上传
  - 支持自定义尺寸
  - 返回纯文本格式的URL列表

  4. 配置文件接口

  接口1: GET /manifest.json
  - 返回插件配置清单文件

  接口2: GET /manifest-lobechat.json
  - 返回 LobeChat 专用配置文件

  智能解析功能

  模型自动识别

  在 prompt 中包含模型关键词会自动识别：
  - "即梦3.1" → jimeng-3.1
  - "即梦3.0" → jimeng-3.0
  - "即梦2.1" → jimeng-2.1
  - "即梦2.0pro" → jimeng-2.0-pro
  - "即梦2.0" → jimeng-2.0

  比例自动识别

  支持中文比例描述：
  - "16:9比例" → 16:9
  - "比例16比9" → 16:9
  - "16：9" → 16:9

  输出格式控制

  通过URL参数

  - ?format=markdown - Markdown格式
  - ?format=plain - 纯文本格式

  通过请求头

  - Accept: text/markdown - Markdown格式
  - Accept: text/plain - 纯文本格式

  自动检测

  - Dify (python-httpx) → 默认Markdown
  - LobeChat (node) → 默认Markdown
  - ComfyUI → 纯文本格式

● Update Todos
  ⎿  ☒ 分析server.ts文件中的HTTP API接口
     ☒ 编写详细的HTTP请求文档
     ☐ 创建Postman集合示例

● Postman 集合示例

  环境变量设置

  在 Postman 中创建环境变量：
  - baseUrl: http://localhost:3400
  - token: your_jimeng_api_token

  1. 通用图像生成接口

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/generateImage

  Headers

  Content-Type: application/json
  Authorization: Bearer {{token}}

  Body (raw JSON)

  {
    "prompt": "一只可爱的小猫咪，坐在花园里，阳光明媚，高清摄影",
    "model": "jimeng-3.1",
    "aspect_ratio": "16:9"
  }

  测试脚本

  pm.test("Status code is 200", function () {
      pm.response.to.have.status(200);
  });

  pm.test("Response contains image markdown", function () {
      pm.expect(pm.response.text()).to.include("![生成图片");
  });

  2. LobeChat 格式调用

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/generateImage

  Headers

  Content-Type: application/json
  x-lobe-plugin-settings: {"JIMENG_API_TOKEN": "{{token}}"}

  Body (raw JSON)

  {
    "id": "lobe-chat-123",
    "apiName": "generateImage",
    "arguments": {
      "prompt": "未来科技城市，霓虹灯闪烁，赛博朋克风格"
    }
  }

  3. Dify 专用接口

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/dify/generateImage

  Headers

  Content-Type: application/json
  Authorization: Bearer {{token}}

  Body (raw JSON)

  {
    "prompt": "中国传统山水画，水墨画风格，山峦叠嶂",
    "model": "jimeng-3.1",
    "aspect_ratio": "3:2"
  }

  4. ComfyUI 专用接口

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/comfyui/generateImage

  Headers

  Authorization: Bearer {{token}}

  Body (form-data)

  prompt: "梦幻森林，精灵在其中飞舞，魔法光芒"
  model: jimeng-3.1
  aspect_ratio: 4:3
  width: 1472
  height: 1104

  5. 带参考图像的生成

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/generateImage

  Headers

  Content-Type: application/json
  Authorization: Bearer {{token}}

  Body (raw JSON)

  {
    "prompt": "将这张图片转换为动漫风格",
    "model": "jimeng-3.1",
    "aspect_ratio": "1:1",
    "filePath": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QD     
  wADhgGAWjR9awAAAABJRU5ErkJggg=="
  }

  6. 智能解析测试

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/generateImage

  Headers

  Content-Type: application/json
  Authorization: Bearer {{token}}

  Body (raw JSON)

  {
    "prompt": "用即梦3.1生成一张16:9比例的风景画，展现春天的美丽"
  }

  7. 纯文本格式输出

  请求配置

  Method: POST
  URL: {{baseUrl}}/api/generateImage?format=plain

  Headers

  Content-Type: application/json
  Authorization: Bearer {{token}}

  Body (raw JSON)

  {
    "prompt": "简约现代建筑设计图"
  }

  错误处理测试

  无Token测试

  {
    "prompt": "测试无token情况"
  }
  预期结果: 401 Unauthorized

  空Prompt测试

  {
    "prompt": ""
  }
  预期结果: 400 Bad Request

  Collection 脚本

  Pre-request Script

  // 自动设置时间戳
  pm.globals.set("timestamp", Date.now());

  // 检查token是否存在
  if (!pm.environment.get("token")) {
      console.log("警告: 未设置API Token");
  }

  Tests Script

  // 通用测试
  pm.test("Response time is less than 30000ms", function () {
      pm.expect(pm.response.responseTime).to.be.below(30000);
  });

  // 记录响应时间
  pm.globals.set("lastResponseTime", pm.response.responseTime);

  // 如果是图像生成成功，保存URL
  if (pm.response.code === 200) {
      const responseText = pm.response.text();
      const urlMatch = responseText.match(/https:\/\/[^\s\)]+/);
      if (urlMatch) {
          pm.globals.set("lastImageUrl", urlMatch[0]);
          console.log("生成的图像URL:", urlMatch[0]);
      }
  }

● Update Todos
  ⎿  ☒ 分析server.ts文件中的HTTP API接口
     ☒ 编写详细的HTTP请求文档
     ☒ 创建Postman集合示例

● 已完成！我为您的即梦AI图像生成服务创建了完整的HTTP API文档和详细的Postman示例。

  总结

  API文档包含:
  - 5个主要接口的完整说明
  - 多种认证方式
  - 智能解析功能
  - 输出格式控制

  Postman集合包含:
  - 7个不同场景的请求示例
  - 环境变量配置
  - 自动化测试脚本
  - 错误处理测试

  主要特点:
  - 支持多平台兼容 (Dify、LobeChat、ComfyUI)
  - 智能模型和比例识别
  - 灵活的输出格式
  - 完整的错误处理
