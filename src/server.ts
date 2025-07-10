// server.ts (支持Markdown图片格式输出 - 最终版)

import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import multer from 'multer';
import { generateImage, ImageGenerationParams } from './api.js';
import { imageDetectorMiddleware } from './imageDetectorMiddleware.js';

// --- 类型定义与共享逻辑 ---
const DIMENSIONS = {
  'jimeng-3.1': { 
      "1:1": { width: 1328, height: 1328 }, 
      "16:9": { width: 1664, height: 936 }, 
      "4:3": { width: 1472, height: 1104 }, 
      "3:2": { width: 1584, height: 1056 }, 
      "21:9": { width: 2016, height: 864 }, 
      "3:4": { width: 1104, height: 1472 }, 
      "2:3": { width: 1056, height: 1584 }, 
      "9:21": { width: 936, height: 1664 }, 
      "9:16": { width: 936, height: 1664 } 
  },
  'jimeng-3.0': { 
      "1:1": { width: 1328, height: 1328 }, 
      "16:9": { width: 1664, height: 936 }, 
      "4:3": { width: 1472, height: 1104 }, 
      "3:2": { width: 1584, height: 1056 }, 
      "21:9": { width: 2016, height: 864 }, 
      "3:4": { width: 1104, height: 1472 }, 
      "2:3": { width: 1056, height: 1584 }, 
      "9:21": { width: 936, height: 1664 }, 
      "9:16": { width: 936, height: 1664 } 
  },
  'default': { 
      "1:1": { width: 1360, height: 1360 }, 
      "16:9": { width: 1360, height: 765 }, 
      "4:3": { width: 1360, height: 1020 }, 
      "3:2": { width: 1360, height: 906 }, 
      "21:9": { width: 1360, height: 582 }, 
      "3:4": { width: 1020, height: 1360 }, 
      "2:3": { width: 906, height: 1360 }, 
      "9:21": { width: 582, height: 1360 }, 
      "9:16": { width: 765, height: 1360 } 
  }
} as const;

type ModelName = keyof typeof DIMENSIONS;
type AspectRatio<M extends ModelName> = keyof typeof DIMENSIONS[M];

// 智能解析函数
function extractModel(promptText: string): { model: string | null, cleanedPrompt: string } {
  const modelKeywords: { [key: string]: string[] } = {
      'jimeng-3.1': ['即梦3.1', 'jimeng-3.1', 'jimeng 3.1'],
      'jimeng-3.0': ['即梦3.0', 'jimeng-3.0', 'jimeng 3.0'],
      'jimeng-2.1': ['即梦2.1', 'jimeng-2.1', 'jimeng 2.1'],
      'jimeng-2.0-pro': ['即梦2.0pro', '即梦2.0 pro', 'jimeng-2.0-pro', 'jimeng 2.0-pro', 'jimeng 2.0 pro'],
      'jimeng-2.0': ['即梦2.0', 'jimeng-2.0', 'jimeng 2.0'],
  };
  
  let foundModel: string | null = null;
  let cleanedPrompt = promptText;
  
  for (const modelName in modelKeywords) {
      for (const keyword of modelKeywords[modelName]) {
          const regex = new RegExp(keyword.replace(/[-\.]/g, '[\\$&]'), 'gi');
          if (regex.test(cleanedPrompt)) {
              foundModel = modelName;
              cleanedPrompt = cleanedPrompt.replace(regex, '').trim();
              break;
          }
      }
      if (foundModel) break;
  }
  return { model: foundModel, cleanedPrompt };
}

function extractAspectRatio(promptText: string): { aspectRatio: string | null, cleanedPrompt: string } {
  const ratioRegex = /(?:比例\s*)?(\d{1,2})[:：比](\d{1,2})(?:\s*比例)?/g;
  let match;
  let foundRatio: string | null = null;
  let cleanedPrompt = promptText;
  
  if ((match = ratioRegex.exec(promptText)) !== null) {
      foundRatio = `${match[1]}:${match[2]}`;
      cleanedPrompt = promptText.replace(match[0], '').trim();
  }
  return { aspectRatio: foundRatio, cleanedPrompt };
}

function getDimensions(model: string, ratio: string): { width: number, height: number } | undefined {
  if (model in DIMENSIONS) {
      const modelKey = model as ModelName;
      const ratiosForModel = DIMENSIONS[modelKey];
      if (ratio in ratiosForModel) {
          const ratioKey = ratio as AspectRatio<typeof modelKey>;
          return ratiosForModel[ratioKey];
      }
  }
  return undefined;
}

// 获取Token的辅助函数
function extractToken(req: Request): string | null {
    console.log('🔍 开始提取Token...');
    
    // 1. 从x-lobe-plugin-settings头获取（LobeChat专用）
    const lobeSettings = req.headers['x-lobe-plugin-settings'];
    if (lobeSettings) {
        try {
            // 处理数组格式的header
            const settingsString = Array.isArray(lobeSettings) ? lobeSettings[0] : lobeSettings;
            if (typeof settingsString === 'string') {
                const settings = JSON.parse(settingsString);
                // 同时检查 JIMENG_API_TOKEN 和 apiToken
                const token = settings.JIMENG_API_TOKEN || settings.apiToken;
                if (token) {
                    console.log('✅ 从x-lobe-plugin-settings获取到Token:', token.substring(0, 10) + '...');
                    return token;
                }
            }
        } catch (e) {
            console.log('❌ 解析x-lobe-plugin-settings失败:', e);
        }
    }
    
    // 2. 从Authorization头获取
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        console.log('✅ 从Authorization头获取到Token:', token.substring(0, 10) + '...');
        return token;
    }
    
    // 3. 从请求体的settings中获取
    if (req.body && req.body.settings) {
        const token = req.body.settings.JIMENG_API_TOKEN || req.body.settings.apiToken;
        if (token) {
            console.log('✅ 从请求体settings获取到Token:', token.substring(0, 10) + '...');
            return token;
        }
    }
    
    // 4. 从环境变量获取（作为fallback）
    if (process.env.JIMENG_API_TOKEN) {
        const token = process.env.JIMENG_API_TOKEN;
        console.log('✅ 从环境变量获取到Token:', token.substring(0, 10) + '...');
        return token;
    }
    
    console.log('❌ 未找到任何Token');
    return null;
  }
  
  

// 格式化输出结果的函数
function formatImageResults(imageUrls: string[], prompt: string, outputFormat: 'markdown' | 'plain' = 'markdown'): string {
  if (!imageUrls || imageUrls.length === 0) {
      return '未能生成图像';
  }
  
  if (outputFormat === 'plain') {
      // 纯链接格式（保持向后兼容）
      return imageUrls.join('\n');
  }
  
  // Markdown格式
  const results: string[] = [];
  
  // 添加标题
  results.push(`## 🎨 即梦AI生成结果`);
  results.push(`**提示词:** ${prompt}`);
  results.push(`**生成数量:** ${imageUrls.length} 张图片`);
  results.push('');
  
  // 添加图片
  imageUrls.forEach((url, index) => {
      const imageTitle = `生成图片 ${index + 1}`;
      results.push(`### ${imageTitle}`);
      results.push(`![${imageTitle}](${url})`);
      results.push('');
  });
  
  // 添加提示信息
  results.push('---');
  results.push('💡 **提示:** 图片链接有时效性，请及时保存所需图片。');
  
  return results.join('\n');
}

// 检测输出格式偏好
function detectOutputFormat(req: Request): 'markdown' | 'plain' {
  // 检查URL参数
  const urlFormat = req.query.format as string;
  if (urlFormat === 'plain' || urlFormat === 'markdown') {
      return urlFormat;
  }
  
  // 检查请求头
  const acceptHeader = req.headers['accept'] || '';
  if (acceptHeader.includes('text/markdown')) {
      return 'markdown';
  }
  
  // 检查User-Agent判断来源
  const userAgent = req.headers['user-agent'] || '';
  
  // Dify通常使用python-httpx
  if (userAgent.includes('python-httpx')) {
      // Dify默认使用markdown格式
      return 'markdown';
  }
  
  // LobeChat使用node
  if (userAgent.includes('node')) {
      // LobeChat默认使用markdown格式
      return 'markdown';
  }
  
  // 默认使用markdown格式
  return 'markdown';
}

// --- 服务器启动函数 ---
export const startServer = async () => {
  const app = express();
  const port = process.env.PORT || 3400;

  app.use(cors({ 
      origin: '*', 
      methods: 'GET,POST,PUT,DELETE,OPTIONS', 
      allowedHeaders: 'Content-Type,Authorization,X-Requested-With,x-lobe-plugin-settings' 
  }));
  
  // 支持多种Content-Type的中间件
  app.use(express.json({ limit: '10mb' }));
  app.use(express.text({ limit: '10mb', type: 'text/plain' }));
  app.use(express.raw({ limit: '10mb', type: 'application/octet-stream' }));
  
  // 添加智能图片检测中间件 (专门为 LobeChat 优化)
  app.use('/api/generateImage', imageDetectorMiddleware());
  
  // 添加请求日志中间件
  app.use((req, res, next) => {
      console.log(`📥 ${req.method} ${req.path}`);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
      console.log('Body type:', typeof req.body);
      console.log('Body:', req.body);
      next();
  });

  // --- 路由定义区域 ---

  app.get('/manifest.json', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'manifest.json'), (err) => {
          if (err) res.status(404).send("找不到 manifest.json 文件");
      });
  });

  app.get('/manifest-lobechat.json', (req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'manifest-lobechat.json'), (err) => {
          if (err) res.status(404).send("找不到 manifest-lobechat.json 文件");
      });
  });

  /**
   * 接口1: /api/generateImage
   * 【兼容接口】: 同时支持Dify和LobeChat调用
   */
  app.post('/api/generateImage', async (req: Request, res: Response): Promise<void> => {
      try {
          console.log('🎯 收到图像生成请求');
          console.log('Content-Type:', req.headers['content-type']);
          console.log('请求体类型:', typeof req.body);
          console.log('请求体内容:', req.body);
          
          // 获取Token
          const token = extractToken(req);
          if (!token) {
              console.error('❌ Token获取失败');
              res.status(401).json({ 
                  error: '请求失败：请在LobeChat插件设置中配置JIMENG_API_TOKEN，或在请求头Authorization字段中提供Bearer Token',
                  debug: {
                      hasAuthHeader: !!req.headers['authorization'],
                      hasLobeSettings: !!req.headers['x-lobe-plugin-settings'],
                      hasBodySettings: !!(req.body && typeof req.body === 'object' && req.body.settings),
                      contentType: req.headers['content-type']
                  }
              });
              return;
          }
          
          let originalPrompt = '';
          let filePath = '';
          let requestData: any = null;
          
          // 处理不同格式的请求体
          if (typeof req.body === 'string') {
              // LobeChat发送的text/plain格式
              console.log('📝 处理text/plain格式请求');
              try {
                  // 尝试解析为JSON
                  requestData = JSON.parse(req.body);
                  console.log('✅ 成功解析text/plain为JSON:', requestData);
              } catch (e) {
                  // 如果不是JSON，可能是直接的prompt文本
                  console.log('📄 将text/plain作为直接prompt处理');
                  originalPrompt = req.body.trim();
              }
          } else if (typeof req.body === 'object' && req.body !== null) {
              // 标准JSON格式
              console.log('📋 处理JSON格式请求');
              requestData = req.body;
          }
          
          // 从解析后的数据中提取参数
          if (requestData) {
              if (requestData.id && requestData.apiName === 'generateImage' && requestData.arguments) {
                  // LobeChat格式：包含完整的插件调用信息
                  console.log('🤖 检测到LobeChat格式调用');
                  
                  let args;
                  try {
                      if (typeof requestData.arguments === 'string') {
                          args = JSON.parse(requestData.arguments);
                      } else {
                          args = requestData.arguments;
                      }
                      console.log('解析后的args:', args);
                  } catch (parseError) {
                      console.error('❌ 解析LobeChat arguments失败:', parseError);
                      res.status(400).json({ 
                          error: 'arguments参数格式错误',
                          debug: {
                              argumentsType: typeof requestData.arguments,
                              argumentsValue: requestData.arguments
                          }
                      });
                      return;
                  }
                  
                  originalPrompt = args.prompt || '';
                  filePath = args.filePath || '';
                  
              } else if (requestData.prompt && typeof requestData.prompt === 'string') {
                  // 直接调用格式
                  console.log('📞 检测到直接调用格式');
                  originalPrompt = requestData.prompt;
                  filePath = requestData.filePath || '';
                  
              } else if (requestData.arguments && typeof requestData.arguments === 'string') {
                  // Dify格式
                  console.log('🔧 检测到Dify格式调用');
                  
                  let args;
                  try {
                      args = JSON.parse(requestData.arguments);
                  } catch (parseError) {
                      console.error('❌ 解析Dify arguments失败:', parseError);
                      res.status(400).json({ error: '请求体格式错误，arguments字段无法解析' });
                      return;
                  }
                  
                  originalPrompt = args.prompt || '';
                  filePath = args.filePath || '';
              }
          }
          
          // 如果还没有prompt，检查是否是直接的文本
          if (!originalPrompt && typeof req.body === 'string') {
              originalPrompt = req.body.trim();
              console.log('📝 使用原始文本作为prompt:', originalPrompt);
          }
          
          if (!originalPrompt) {
              console.error('❌ prompt为空');
              res.status(400).json({ 
                  error: 'prompt参数不能为空',
                  debug: {
                      bodyType: typeof req.body,
                      bodyContent: req.body,
                      requestData: requestData
                  }
              });
              return;
          }
          
          console.log('✅ 提取到prompt:', originalPrompt);
          
          // 智能解析prompt中的模型和比例信息
          const { model: extractedModel, cleanedPrompt: promptAfterModel } = extractModel(originalPrompt);
          const { aspectRatio: extractedRatio, cleanedPrompt: finalPrompt } = extractAspectRatio(promptAfterModel);

          // 如果中间件处理过了，优先使用中间件的结果
          const middlewareProcessed = req.body.cleanedPrompt || req.body.detectedImages;
          let actualPrompt = finalPrompt;
          let actualFilePath = filePath;
          let actualRatio = extractedRatio;

          if (middlewareProcessed) {
              console.log('✨ 使用中间件处理的结果');
              actualPrompt = req.body.cleanedPrompt || finalPrompt;
              actualFilePath = req.body.filePath || filePath;
              actualRatio = req.body.aspect_ratio || extractedRatio;
          }

          const finalArgs: ImageGenerationParams = { 
              prompt: actualPrompt.replace(/^用/, '').trim(), 
              model: extractedModel || 'jimeng-3.1' 
          };
          
          const ratio = actualRatio || '16:9';
          const dimensions = getDimensions(finalArgs.model!, ratio);
          if (dimensions) {
              finalArgs.width = dimensions.width;
              finalArgs.height = dimensions.height;
          }
          
          if (actualFilePath) {
              finalArgs.filePath = actualFilePath;
          }
          
          console.log('🎨 最终生成参数:', finalArgs);
          
          const imageUrls = await generateImage(finalArgs, token);
          if (imageUrls && imageUrls.length > 0) {
              console.log('✅ 图像生成成功:', imageUrls);
              
              // 检测输出格式
              const outputFormat = detectOutputFormat(req);
              console.log('📄 输出格式:', outputFormat);
              
              const formattedResult = formatImageResults(imageUrls, originalPrompt, outputFormat);
              
              if (outputFormat === 'markdown') {
                  res.type('text/markdown').send(formattedResult);
              } else {
                  res.type('text/plain').send(formattedResult);
              }
          } else {
              console.error('❌ 未能生成图像URL');
              res.status(500).json({ error: '未能生成图像URL' });
          }
          
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error('💥 图像生成错误:', errorMessage);
          console.error('错误堆栈:', error);
          res.status(500).json({ error: `图像生成失败: ${errorMessage}` });
      }
  });

  /**
   * 接口2: /api/dify/generateImage
   * 【Dify专用接口】: 支持Markdown格式输出
   */
  app.post('/api/dify/generateImage', async (req: Request, res: Response): Promise<void> => {
      try {
          const authHeader = req.headers['authorization'];
          const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : '';
          if (!token) {
              res.status(401).json({ error: '请求失败：请在请求头(Headers)的 Authorization 字段中提供 Bearer Token' });
              return;
          }

          const { prompt, model = 'jimeng-3.1', aspect_ratio = '16:9', filePath } = req.body;
          if (!prompt) {
              res.status(400).json({ error: '"prompt" 字段是必需的' });
              return;
          }

          const finalArgs: ImageGenerationParams = { prompt, model };
          const dimensions = getDimensions(model, aspect_ratio);
          if (dimensions) {
              finalArgs.width = dimensions.width;
              finalArgs.height = dimensions.height;
          }
          if (filePath) finalArgs.filePath = filePath;
          
          const imageUrls = await generateImage(finalArgs, token);
          if (imageUrls && imageUrls.length > 0) {
              // 检测输出格式
              const outputFormat = detectOutputFormat(req);
              console.log('📄 [Dify] 输出格式:', outputFormat);
              
              const formattedResult = formatImageResults(imageUrls, prompt, outputFormat);
              
              if (outputFormat === 'markdown') {
                  res.type('text/markdown').send(formattedResult);
              } else {
                  res.type('text/plain').send(formattedResult);
              }
          } else {
              res.status(500).json({ error: '未能生成图像URL' });
          }
      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          res.status(500).json({ error: `[Dify] 图像生成失败: ${errorMessage}` });
      }
  });

// =================================================================
// ==== 复制粘贴开始：这是【带确认日志的最终版】ComfyUI专用接口 ====
// =================================================================
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } }); // 限制20MB
app.post('/api/comfyui/generateImage', upload.single('image'), async (req: Request, res: Response): Promise<void> => {

    console.log('✅ 收到来自 ComfyUI 的专用请求');
    try {
        const token = extractToken(req);
        if (!token) {
            res.status(401).json({ error: 'Token 未提供或无效' });
            return;
        }
        

        const { prompt, model, aspect_ratio, width, height, init_image } = req.body;
        const imageFile = req.file;

        if (!prompt) {
            res.status(400).json({ error: 'prompt 参数不能为空' });
            return;
        }

        const finalArgs: ImageGenerationParams = { prompt, model };

        if (width && height) {
            finalArgs.width = parseInt(width, 10);
            finalArgs.height = parseInt(height, 10);
        } else {
            const ratio = aspect_ratio || '1:1';
            const dimensions = getDimensions(model, ratio);
            if (dimensions) {
                finalArgs.width = dimensions.width;
                finalArgs.height = dimensions.height;
            }
        }

        // 处理图片上传：支持multipart/form-data (imageFile) 和 JSON (init_image)
        if (imageFile) {
            console.log(`🖼️  ComfyUI 上传了文件 (multipart): ${imageFile.originalname}`);
            finalArgs.filePath = `data:${imageFile.mimetype};base64,${imageFile.buffer.toString('base64')}`;
        } else if (init_image) {
            console.log(`🖼️  ComfyUI 发送了Base64图片数据 (JSON): ${init_image.substring(0, 50)}...`);
            // 如果已经是完整的data URL，直接使用；否则添加前缀
            if (init_image.startsWith('data:')) {
                finalArgs.filePath = init_image;
            } else {
                finalArgs.filePath = `data:image/png;base64,${init_image}`;
            }
        }

        console.log('🎨  最终生成参数:', { ...finalArgs, filePath: finalArgs.filePath ? '...base64_data...' : 'null' });

        const imageUrls = await generateImage(finalArgs, token);

        if (imageUrls && imageUrls.length > 0) {
            const plainTextResult = imageUrls.join('\n');
            console.log('✅ 准备向 ComfyUI 返回图片URL列表');
            res.type('text/plain').send(plainTextResult);
        } else {
            res.status(500).json({ error: '未能生成图像URL' });
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('💥 ComfyUI 接口错误:', errorMessage, error);
        res.status(500).json({ error: `ComfyUI 接口处理失败: ${errorMessage}` });
    }
});

// 新增的确认日志，如果服务启动时能看到这一行，说明代码更新成功了！
console.log('✅ ComfyUI专用接口 /api/comfyui/generateImage 已准备就绪！');
// =================================================================
// ==== 复制粘贴结束 ====
// =================================================================

  // --- 启动服务器 ---
  app.listen(port, () => {
      console.log(`🚀 即梦HTTP服务已启动，正在监听端口: ${port}`);
      console.log(`📋 插件清单地址: http://<your_ip>:${port}/manifest.json`);
      console.log(`🤖 LobeChat清单地址: http://<your_ip>:${port}/manifest-lobechat.json`);
      console.log(`✨ 新功能: 支持Markdown格式图片输出！`);
      console.log(`   - 默认输出: Markdown格式`);
      console.log(`   - 纯链接格式: 添加 ?format=plain 参数`);
  });
};