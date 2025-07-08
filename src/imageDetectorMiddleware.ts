import { Request, Response, NextFunction } from 'express';
import * as fs from 'fs';
import * as path from 'path';

// 智能图片检测和比例推断中间件 - LobeChat 专用优化版本
export function imageDetectorMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // 检查是否为 LobeChat 请求
            const isLobeChat = req.headers['user-agent']?.includes('node') || 
                              req.headers['x-lobe-plugin-settings'] ||
                              (req.body && req.body.id && req.body.apiName === 'generateImage');
            
            if (!isLobeChat) {
                return next(); // 非 LobeChat 请求，跳过处理
            }

            const { prompt } = req.body;
            
            if (!prompt) {
                return next();
            }

            console.log('🔍 [LobeChat] 开始智能图片检测和参数分离');

            // 扩展的图片检测正则表达式
            const imagePatterns = [
                // HTTP/HTTPS 图片链接 (优先级最高)
                /https?:\/\/[^\s\)]+\.(jpg|jpeg|png|gif|bmp|webp|svg)(\?[^\s\)]*)?/gi,
                // Base64 图片
                /data:image\/[^;]+;base64,[A-Za-z0-9+\/=]+/gi,
                // 文件路径 (本地文件)
                /(?:file:\/\/|\.\/|\/)?([^\s\)]*\.(jpg|jpeg|png|gif|bmp|webp|svg))/gi,
                // 图片占位符
                /\[图片\]|\[image\]|\[img\]|\[IMAGE\]/gi,
                // LobeChat 图片引用模式
                /!\[.*?\]\([^\)]+\)/gi
            ];

            const detectedImages = [];
            let cleanedPrompt = prompt;

            // 遍历所有图片检测模式
            imagePatterns.forEach(pattern => {
                let match;
                while ((match = pattern.exec(prompt)) !== null) {
                    const fullMatch = match[0];
                    let imagePath = match[1] || fullMatch;
                    
                    // 特殊处理 markdown 图片格式
                    if (fullMatch.startsWith('![')) {
                        const markdownMatch = fullMatch.match(/!\[.*?\]\(([^\)]+)\)/);
                        if (markdownMatch) {
                            imagePath = markdownMatch[1];
                        }
                    }
                    
                    // 添加到检测结果
                    detectedImages.push({
                        original: fullMatch,
                        path: imagePath,
                        type: getImageType(fullMatch),
                        aspectRatio: null // 后续分析
                    });

                    // 从prompt中移除图片引用，保持文本干净
                    cleanedPrompt = cleanedPrompt.replace(fullMatch, '').trim();
                }
            });

            // 检测上传的文件
            if (req.files || (req as any).file) {
                const files = req.files || [(req as any).file];
                Array.isArray(files) ? files.forEach(file => {
                    if (file && isImageFile(file.originalname || file.name)) {
                        detectedImages.push({
                            original: file.originalname || file.name,
                            path: file.path || file.filename,
                            type: 'uploaded',
                            file: file,
                            aspectRatio: null
                        });
                    }
                }) : null;
            }

            // 智能清理 prompt 中的技术参数词汇
            cleanedPrompt = cleanPromptFromTechnicalTerms(cleanedPrompt);

            // 检测并推断图片比例
            if (detectedImages.length > 0) {
                console.log('🖼️ [LobeChat] 检测到图片:', detectedImages.length, '个');
                
                // 设置第一个图片作为主要参考
                req.body.filePath = detectedImages[0].path;
                
                // 尝试推断图片比例
                const inferredRatio = await inferImageAspectRatio(detectedImages[0]);
                if (inferredRatio && !req.body.aspect_ratio) {
                    req.body.aspect_ratio = inferredRatio;
                    console.log('📐 [LobeChat] 推断图片比例:', inferredRatio);
                }
                
                console.log('📁 [LobeChat] 设置filePath:', req.body.filePath);
            }

            // 将处理结果添加到请求体
            req.body.detectedImages = detectedImages;
            req.body.cleanedPrompt = cleanedPrompt;
            
            console.log('✨ [LobeChat] 原始prompt:', prompt);
            console.log('🧹 [LobeChat] 清理后prompt:', cleanedPrompt);

            next();
        } catch (error) {
            console.error('❌ [LobeChat] 图片检测中间件错误:', error);
            next(); // 即使出错也继续处理
        }
    };
}

// 清理 prompt 中的技术参数词汇
function cleanPromptFromTechnicalTerms(prompt: string): string {
    let cleaned = prompt;
    
    // 移除模型相关词汇
    const modelPatterns = [
        /即梦[\d\.]+[pro]*|jimeng[-\d\.]+[pro]*/gi,
        /模型[：:]\s*[^\s,，。]+/gi,
        /使用.*?模型/gi
    ];
    
    // 移除比例相关词汇
    const ratioPatterns = [
        /比例[：:]?\s*\d+[：:比]\d+/gi,
        /\d+[：:比]\d+\s*比例?/gi,
        /宽高比[：:]?\s*\d+[：:比]\d+/gi
    ];
    
    // 移除图片引用词汇
    const imageRefPatterns = [
        /参考.*?图[片]?/gi,
        /根据.*?图[片]?/gi,
        /按照.*?图[片]?/gi,
        /基于.*?图[片]?/gi,
        /参考提供的/gi,
        /参考这张/gi,
        /根据上传的/gi
    ];
    
    [...modelPatterns, ...ratioPatterns, ...imageRefPatterns].forEach(pattern => {
        cleaned = cleaned.replace(pattern, '').trim();
    });
    
    // 清理多余的标点符号和空白
    cleaned = cleaned.replace(/[，,。]+/g, '，').replace(/\s+/g, ' ').trim();
    cleaned = cleaned.replace(/^[，,。\s]+|[，,。\s]+$/g, '');
    
    return cleaned;
}

// 推断图片宽高比
async function inferImageAspectRatio(imageInfo: any): Promise<string | null> {
    try {
        // 支持的比例选项
        const supportedRatios = ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"];
        
        // 如果是URL，尝试获取图片尺寸
        if (imageInfo.type === 'url' && imageInfo.path.startsWith('http')) {
            // 这里可以扩展为实际的图片尺寸检测
            // 目前返回默认比例
            return "16:9";
        }
        
        // 如果是上传的文件，尝试分析文件
        if (imageInfo.file && imageInfo.file.buffer) {
            // 这里可以添加图片尺寸分析逻辑
            // 简单实现：根据文件名或默认规则推断
            return "1:1";
        }
        
        return null;
    } catch (error) {
        console.error('❌ 推断图片比例失败:', error);
        return null;
    }
}

// 判断图片类型
function getImageType(imageRef: string): string {
    if (imageRef.startsWith('data:image')) return 'base64';
    if (imageRef.startsWith('http')) return 'url';
    if (imageRef.includes('[图片]') || imageRef.includes('[image]')) return 'placeholder';
    return 'file';
}

// 判断是否为图片文件
function isImageFile(filename: string): boolean {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
    const ext = path.extname(filename).toLowerCase();
    return imageExtensions.includes(ext);
}

// 检查文件是否存在
function fileExists(filePath: string): boolean {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}