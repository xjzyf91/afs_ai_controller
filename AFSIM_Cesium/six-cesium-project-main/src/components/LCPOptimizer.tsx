import { useEffect } from "react";

interface LCPOptimizerProps {
    children: React.ReactNode;
}

interface LCPEntry extends PerformanceEntry {
    element?: Element;
}

const LCPOptimizer: React.FC<LCPOptimizerProps> = ({ children }) => {
    useEffect(() => {
        // 预加载关键字体
        const preloadFont = (
            fontUrl: string,
            fontFamily: string,
            weight: string
        ) => {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = "font";
            link.type = "font/woff2";
            link.crossOrigin = "anonymous";
            link.href = fontUrl;
            document.head.appendChild(link);

            // 创建字体面
            const fontFace = new FontFace(fontFamily, `url(${fontUrl})`, {
                weight,
                style: "normal",
                display: "swap",
            });

            fontFace
                .load()
                .then(loadedFace => {
                    document.fonts.add(loadedFace);
                    console.log(`✅ 字体预加载完成: ${fontFamily} ${weight}`);
                })
                .catch(err => {
                    console.warn(`❌ 字体预加载失败: ${fontFamily}`, err);
                });
        };

        // 预加载关键字体
        preloadFont(
            "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiA.woff2",
            "Inter",
            "400"
        );
        preloadFont(
            "https://fonts.gstatic.com/s/inter/v12/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYAZ9hiA.woff2",
            "Inter",
            "600"
        );

        // 优化关键渲染路径
        const optimizeCriticalPath = () => {
            // 确保header立即可见
            const header = document.querySelector("header");
            if (header) {
                header.style.willChange = "auto"; // 移除will-change以节省内存
            }

            // 预热Cesium容器
            const cesiumContainer = document.querySelector("main");
            if (cesiumContainer) {
                cesiumContainer.style.contain = "layout style paint";
                cesiumContainer.style.contentVisibility = "auto";
            }
        };

        // 使用 requestIdleCallback 在空闲时优化
        if ("requestIdleCallback" in window) {
            requestIdleCallback(optimizeCriticalPath);
        } else {
            setTimeout(optimizeCriticalPath, 0);
        }

        // 监控LCP
        if ("PerformanceObserver" in window) {
            const lcpObserver = new PerformanceObserver(list => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1] as LCPEntry; // LCP entry has element property

                console.log("🎯 LCP Element:", lastEntry.element);
                console.log(
                    "🎯 LCP Time:",
                    lastEntry.startTime.toFixed(2),
                    "ms"
                );

                // 如果LCP元素是H1，优化它
                if (lastEntry.element?.tagName === "H1") {
                    const h1 = lastEntry.element as HTMLElement;
                    // 优化文本渲染
                    h1.style.textRendering = "optimizeSpeed";
                    h1.style.fontKerning = "none";
                }
            });

            lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

            return () => {
                lcpObserver.disconnect();
            };
        }
    }, []);

    return <>{children}</>;
};

export default LCPOptimizer;
