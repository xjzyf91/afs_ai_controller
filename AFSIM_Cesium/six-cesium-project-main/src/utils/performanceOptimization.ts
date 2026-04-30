// 性能优化工具

interface PerformanceMetrics {
    fcp: number;
    lcp: number;
    fid: number;
    cls: number;
    ttfb: number;
    tti: number; // Time to Interactive
    tbt: number; // Total Blocking Time
    si: number; // Speed Index
    domContentLoaded: number;
    loadComplete: number;
    memoryUsage?: {
        used: number;
        total: number;
        limit: number;
    };
}

export class PerformanceOptimizer {
    private static instance: PerformanceOptimizer;
    private preloadedModules = new Map<string, unknown>();
    private metrics: Partial<PerformanceMetrics> = {};
    private observer: PerformanceObserver | null = null;
    private ttiStartTime: number = 0;
    private isInteractive: boolean = false;
    private longTaskCount: number = 0;
    private measurementTimeout: NodeJS.Timeout | null = null;

    static getInstance(): PerformanceOptimizer {
        if (!PerformanceOptimizer.instance) {
            PerformanceOptimizer.instance = new PerformanceOptimizer();
        }
        return PerformanceOptimizer.instance;
    }

    // 获取当前性能指标
    getMetrics(): Partial<PerformanceMetrics> {
        return { ...this.metrics };
    }

    // 检查页面是否已交互
    private checkInteractivity() {
        if (this.isInteractive) return;

        const now = performance.now();

        // 简化的TTI检测：DOM加载完成 + 没有长任务 + 主要资源加载完成
        if (document.readyState === "complete" && this.longTaskCount === 0) {
            this.isInteractive = true;
            this.metrics.tti = now;
            console.log("🎯 TTI:", this.metrics.tti.toFixed(2), "ms");

            // TTI超过5秒发出警告
            if (this.metrics.tti > 5000) {
                console.warn("⚠️ TTI超过5秒，页面交互性能需要优化");
                this.suggestTTIOptimizations();
            }
        }
    }

    // TTI优化建议
    private suggestTTIOptimizations() {
        console.group("🔧 TTI优化建议:");
        console.log("1. 减少JavaScript包大小");
        console.log("2. 代码分割和懒加载");
        console.log("3. 移除未使用的代码");
        console.log("4. 优化第三方脚本加载");
        console.log("5. 使用Web Workers处理重计算");
        console.log("6. 减少主线程阻塞时间");
        console.groupEnd();
    }

    // 获取内存使用情况
    private getMemoryUsage() {
        if ("memory" in performance) {
            const memory = (
                performance as unknown as {
                    memory?: {
                        usedJSHeapSize: number;
                        totalJSHeapSize: number;
                        jsHeapSizeLimit: number;
                    };
                }
            ).memory;

            if (memory) {
                this.metrics.memoryUsage = {
                    used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
                    total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
                    limit: Math.round(memory.jsHeapSizeLimit / 1024 / 1024), // MB
                };
            }
        }
    }

    // 预加载关键模块
    async preloadCriticalModules() {
        const criticalModules = [
            () => import("../view/FirstPage.tsx"),
            () => import("../components/LoadingSpinner.tsx"),
        ];

        const promises = criticalModules.map(async (moduleLoader, index) => {
            try {
                const module = await moduleLoader();
                this.preloadedModules.set(`critical-${index}`, module);
                console.log(`✅ 预加载关键模块 ${index + 1}`);
            } catch (error) {
                console.warn(`❌ 预加载关键模块 ${index + 1} 失败:`, error);
            }
        });

        await Promise.all(promises);
    }

    // 预加载用户可能交互的模块
    async preloadUserInteractionModules() {
        // 延迟预加载，避免阻塞关键渲染路径
        setTimeout(async () => {
            const interactionModules = [
                () => import("../view/ModelSelectionModal.tsx"),
                () => import("../view/RealTimeSimulationModal.tsx"),
            ];

            for (const moduleLoader of interactionModules) {
                try {
                    const module = await moduleLoader();
                    this.preloadedModules.set(moduleLoader.toString(), module);
                    console.log("✅ 预加载交互模块");
                } catch (error) {
                    console.warn("❌ 预加载交互模块失败:", error);
                }
            }
        }, 2000); // 2秒后开始预加载
    }

    // 添加资源提示
    addResourceHints() {
        const hints = [
            { rel: "dns-prefetch", href: "//fonts.googleapis.com" },
            { rel: "preconnect", href: "https://cesium.com" },
        ];

        hints.forEach(hint => {
            const link = document.createElement("link");
            link.rel = hint.rel;
            link.href = hint.href;
            document.head.appendChild(link);
        });
    }

    private setupPerformanceObserver() {
        if ("PerformanceObserver" in window) {
            this.observer = new PerformanceObserver(list => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === "largest-contentful-paint") {
                        this.metrics.lcp = entry.startTime;
                        console.log(
                            "🎯 LCP:",
                            entry.startTime.toFixed(2),
                            "ms"
                        );

                        // 如果LCP超过2.5秒，记录警告
                        if (entry.startTime > 2500) {
                            console.warn("⚠️ LCP超过2.5秒，需要优化");
                            this.suggestLCPOptimizations();
                        }
                    }

                    if (entry.entryType === "first-contentful-paint") {
                        this.metrics.fcp = entry.startTime;
                        console.log(
                            "🎨 FCP:",
                            entry.startTime.toFixed(2),
                            "ms"
                        );
                    }

                    if (entry.entryType === "navigation") {
                        const navEntry = entry as PerformanceNavigationTiming;
                        this.metrics.ttfb =
                            navEntry.responseStart - navEntry.requestStart;
                        this.metrics.domContentLoaded =
                            navEntry.domContentLoadedEventEnd -
                            navEntry.fetchStart;
                        this.metrics.loadComplete =
                            navEntry.loadEventEnd - navEntry.fetchStart;

                        console.log(
                            "🌐 TTFB:",
                            this.metrics.ttfb.toFixed(2),
                            "ms"
                        );
                        console.log(
                            "📄 DOM Content Loaded:",
                            this.metrics.domContentLoaded.toFixed(2),
                            "ms"
                        );
                        console.log(
                            "✅ Load Complete:",
                            this.metrics.loadComplete.toFixed(2),
                            "ms"
                        );
                    }

                    // 监听长任务
                    if (entry.entryType === "longtask") {
                        this.longTaskCount++;
                        console.warn(
                            "⏱️ 检测到长任务:",
                            entry.duration.toFixed(2),
                            "ms"
                        );

                        // 重置TTI检测
                        this.isInteractive = false;

                        // 延迟检查交互性
                        setTimeout(() => this.checkInteractivity(), 100);
                    }

                    // 监听布局偏移
                    if (entry.entryType === "layout-shift") {
                        const layoutShiftEntry = entry as PerformanceEntry & {
                            value: number;
                            hadRecentInput: boolean;
                        };
                        if (!layoutShiftEntry.hadRecentInput) {
                            this.metrics.cls =
                                (this.metrics.cls || 0) +
                                layoutShiftEntry.value;
                            if (this.metrics.cls > 0.1) {
                                console.warn(
                                    "⚠️ CLS超过0.1，布局稳定性需要优化"
                                );
                            }
                        }
                    }
                }
            });

            // 观察关键性能指标
            this.observer.observe({
                entryTypes: [
                    "largest-contentful-paint",
                    "first-contentful-paint",
                    "navigation",
                    "longtask",
                    "layout-shift",
                ],
            });

            // 设置测量超时，避免无限等待
            this.measurementTimeout = setTimeout(() => {
                if (!this.isInteractive) {
                    this.isInteractive = true;
                    this.metrics.tti = performance.now();
                    console.log(
                        "⏰ TTI测量超时，使用当前时间:",
                        this.metrics.tti.toFixed(2),
                        "ms"
                    );
                }
                this.getMemoryUsage();
                this.logFinalMetrics();
            }, 10000) as unknown as NodeJS.Timeout; // 10秒超时
        }

        // 监听DOM状态变化
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                setTimeout(() => this.checkInteractivity(), 100);
            });
        }

        if (document.readyState !== "complete") {
            window.addEventListener("load", () => {
                setTimeout(() => this.checkInteractivity(), 100);
            });
        } else {
            // 页面已经加载完成
            setTimeout(() => this.checkInteractivity(), 100);
        }
    }

    // 记录最终指标
    private logFinalMetrics() {
        console.group("📊 最终性能指标:");
        Object.entries(this.metrics).forEach(([key, value]) => {
            if (
                key === "memoryUsage" &&
                value &&
                typeof value === "object" &&
                "used" in value
            ) {
                const memValue = value as {
                    used: number;
                    total: number;
                    limit: number;
                };
                console.log(
                    `💾 内存使用: ${memValue.used}MB / ${memValue.total}MB (限制: ${memValue.limit}MB)`
                );
            } else if (typeof value === "number") {
                console.log(`${key.toUpperCase()}: ${value.toFixed(2)}ms`);
            }
        });
        console.groupEnd();
    }

    private optimizeImages() {
        // 延迟加载图片
        const images = document.querySelectorAll("img[data-src]");
        const imageObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    img.src = img.dataset.src || "";
                    img.removeAttribute("data-src");
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => imageObserver.observe(img));
    }

    private preloadCriticalResources() {
        // 预加载关键资源
        const criticalResources = [
            "/src/view/FirstPage.tsx",
            "/src/components/LoadingSpinner.tsx",
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement("link");
            link.rel = "modulepreload";
            link.href = resource;
            document.head.appendChild(link);
        });
    }

    private optimizeFonts() {
        // 优化字体加载
        if ("fonts" in document) {
            // 预加载关键字体
            const fontFaces = [
                new FontFace(
                    "Inter",
                    "url(https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2)",
                    {
                        weight: "400",
                        style: "normal",
                        display: "swap",
                    }
                ),
                new FontFace(
                    "Inter",
                    "url(https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2)",
                    {
                        weight: "600",
                        style: "normal",
                        display: "swap",
                    }
                ),
            ];

            fontFaces.forEach(fontFace => {
                fontFace
                    .load()
                    .then(loadedFace => {
                        document.fonts.add(loadedFace);
                    })
                    .catch(err => {
                        console.warn("字体加载失败:", err);
                    });
            });
        }
    }

    private setupIntersectionObserver() {
        // 为懒加载组件设置交叉观察器
        const lazyComponents = document.querySelectorAll("[data-lazy]");
        const componentObserver = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target as HTMLElement;
                        const componentName = element.dataset.lazy;

                        // 动态导入组件
                        if (componentName) {
                            import(`../view/${componentName}.tsx`)
                                .then(() => {
                                    console.log(
                                        `✅ 懒加载组件: ${componentName}`
                                    );
                                })
                                .catch(err => {
                                    console.warn(
                                        `❌ 懒加载组件失败: ${componentName}`,
                                        err
                                    );
                                });
                        }

                        componentObserver.unobserve(element);
                    }
                });
            },
            {
                rootMargin: "50px", // 提前50px开始加载
            }
        );

        lazyComponents.forEach(component =>
            componentObserver.observe(component)
        );
    }

    private optimizeCesiumLoading() {
        // 优化Cesium加载
        const cesiumContainer = document.querySelector("#cesium-container");
        if (cesiumContainer) {
            // 为Cesium容器添加现代化占位符
            cesiumContainer.innerHTML = `
                <div style="
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16213e 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-family: 'Inter', 'Microsoft YaHei', sans-serif;
                    position: relative;
                    overflow: hidden;
                ">
                    <!-- 背景动画粒子 -->
                    <div style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background-image: 
                            radial-gradient(2px 2px at 20px 30px, rgba(255,255,255,0.1), transparent),
                            radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.05), transparent),
                            radial-gradient(1px 1px at 90px 40px, rgba(255,255,255,0.08), transparent),
                            radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.06), transparent),
                            radial-gradient(2px 2px at 160px 30px, rgba(255,255,255,0.04), transparent);
                        background-repeat: repeat;
                        background-size: 200px 100px;
                        animation: stars 20s linear infinite;
                        opacity: 0.6;
                    "></div>
                    
                    <!-- 主要内容 -->
                    <div style="
                        position: relative;
                        z-index: 2;
                        text-align: center;
                        max-width: 400px;
                        padding: 40px 20px;
                    ">
                        <!-- 地球图标 -->
                        <div style="
                            width: 80px;
                            height: 80px;
                            margin: 0 auto 30px;
                            position: relative;
                            border-radius: 50%;
                            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            box-shadow: 0 0 30px rgba(79, 172, 254, 0.3);
                            animation: earthRotate 4s linear infinite;
                        ">
                            <div style="
                                width: 60px;
                                height: 60px;
                                border-radius: 50%;
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                position: relative;
                                overflow: hidden;
                            ">
                                <div style="
                                    position: absolute;
                                    top: 10px;
                                    left: 15px;
                                    width: 20px;
                                    height: 15px;
                                    background: rgba(255,255,255,0.2);
                                    border-radius: 50% 20% 50% 20%;
                                    animation: continentMove 6s ease-in-out infinite;
                                "></div>
                                <div style="
                                    position: absolute;
                                    bottom: 8px;
                                    right: 12px;
                                    width: 15px;
                                    height: 12px;
                                    background: rgba(255,255,255,0.15);
                                    border-radius: 30% 70% 30% 70%;
                                    animation: continentMove 8s ease-in-out infinite reverse;
                                "></div>
                            </div>
                        </div>
                        
                        <!-- 标题 -->
                        <h2 style="
                            margin: 0 0 15px 0;
                            font-size: 24px;
                            font-weight: 600;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                            animation: titleGlow 3s ease-in-out infinite;
                        ">飞行器可视化仿真软件</h2>
                        
                        <!-- 副标题 -->
                        <p style="
                            margin: 0 0 30px 0;
                            font-size: 14px;
                            color: rgba(255,255,255,0.7);
                            line-height: 1.5;
                        ">正在初始化三维地球环境...</p>
                        
                        <!-- 进度条容器 -->
                        <div style="
                            width: 100%;
                            height: 6px;
                            background: rgba(255,255,255,0.1);
                            border-radius: 3px;
                            overflow: hidden;
                            margin-bottom: 20px;
                            position: relative;
                        ">
                            <div style="
                                height: 100%;
                                background: linear-gradient(90deg, #4facfe 0%, #00f2fe 50%, #4facfe 100%);
                                border-radius: 3px;
                                animation: progressFlow 2.5s ease-in-out infinite;
                                box-shadow: 0 0 10px rgba(79, 172, 254, 0.5);
                            "></div>
                        </div>
                        
                        <!-- 加载提示 -->
                        <div style="
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 8px;
                            font-size: 13px;
                            color: rgba(255,255,255,0.6);
                        ">
                            <div style="
                                width: 6px;
                                height: 6px;
                                border-radius: 50%;
                                background: #4facfe;
                                animation: dotPulse 1.5s ease-in-out infinite;
                            "></div>
                            <div style="
                                width: 6px;
                                height: 6px;
                                border-radius: 50%;
                                background: #4facfe;
                                animation: dotPulse 1.5s ease-in-out infinite 0.2s;
                            "></div>
                            <div style="
                                width: 6px;
                                height: 6px;
                                border-radius: 50%;
                                background: #4facfe;
                                animation: dotPulse 1.5s ease-in-out infinite 0.4s;
                            "></div>
                            <span style="margin-left: 10px;">加载中</span>
                        </div>
                    </div>
                </div>
                <style>
                    @keyframes stars {
                        0% { transform: translateY(0); }
                        100% { transform: translateY(-100px); }
                    }
                    
                    @keyframes earthRotate {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    
                    @keyframes continentMove {
                        0%, 100% { opacity: 0.2; transform: scale(1); }
                        50% { opacity: 0.4; transform: scale(1.1); }
                    }
                    
                    @keyframes titleGlow {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.8; }
                    }
                    
                    @keyframes progressFlow {
                        0% { width: 0%; transform: translateX(-100%); }
                        50% { width: 100%; transform: translateX(0%); }
                        100% { width: 0%; transform: translateX(100%); }
                    }
                    
                    @keyframes dotPulse {
                        0%, 100% { opacity: 0.3; transform: scale(1); }
                        50% { opacity: 1; transform: scale(1.2); }
                    }
                </style>
            `;
        }
    }

    private setupResourceHints() {
        // 添加资源提示
        const hints = [
            { rel: "dns-prefetch", href: "//fonts.googleapis.com" },
            { rel: "dns-prefetch", href: "//fonts.gstatic.com" },
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            {
                rel: "preconnect",
                href: "https://fonts.gstatic.com",
                crossorigin: true,
            },
        ];

        hints.forEach(hint => {
            const link = document.createElement("link");
            link.rel = hint.rel;
            link.href = hint.href;
            if (hint.crossorigin) {
                link.crossOrigin = "anonymous";
            }
            document.head.appendChild(link);
        });
    }

    private suggestLCPOptimizations() {
        console.group("🔧 LCP优化建议:");
        console.log("1. 优化服务器响应时间 (TTFB < 600ms)");
        console.log("2. 移除阻塞渲染的资源");
        console.log("3. 优化CSS加载顺序");
        console.log("4. 使用适当的图片格式和尺寸");
        console.log("5. 实施有效的缓存策略");
        console.log("6. 考虑使用CDN");
        console.groupEnd();
    }

    // 手动触发性能测量
    measurePerformance() {
        if (performance.getEntriesByType) {
            const navigation = performance.getEntriesByType(
                "navigation"
            )[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType("paint");

            console.group("📊 性能指标:");
            console.log(
                "DNS查询:",
                (
                    navigation.domainLookupEnd - navigation.domainLookupStart
                ).toFixed(2),
                "ms"
            );
            console.log(
                "TCP连接:",
                (navigation.connectEnd - navigation.connectStart).toFixed(2),
                "ms"
            );
            console.log(
                "请求响应:",
                (navigation.responseEnd - navigation.requestStart).toFixed(2),
                "ms"
            );
            console.log(
                "DOM解析:",
                (
                    navigation.domContentLoadedEventEnd - navigation.responseEnd
                ).toFixed(2),
                "ms"
            );

            paint.forEach(entry => {
                console.log(entry.name + ":", entry.startTime.toFixed(2), "ms");
            });
            console.groupEnd();
        }
    }

    // 初始化所有优化
    init() {
        this.setupPerformanceObserver();
        this.optimizeImages();
        this.preloadCriticalModules();
        this.preloadUserInteractionModules();
        this.optimizeFonts();
        this.setupIntersectionObserver();
        this.optimizeCesiumLoading();
        this.setupResourceHints();
    }

    // 清理资源
    cleanup() {
        if (this.observer) {
            this.observer.disconnect();
        }
    }
}

// 导出单例实例
export const performanceOptimizer = PerformanceOptimizer.getInstance();
