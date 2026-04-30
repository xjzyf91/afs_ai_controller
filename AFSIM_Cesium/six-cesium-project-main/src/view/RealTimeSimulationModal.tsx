// src/view/RealTimeSimulationModal.tsx
import React, { useState, useRef } from "react";
import "./RealTimeSimulationModal.css";
import * as Cesium from "cesium";

// 定义接口
interface ModelData {
    longitude: number;
    latitude: number;
    altitude: number;
    yaw: number;
    pitch: number;
    roll: number;
}

interface WebSocketData {
    model1?: ModelData;
    model2?: ModelData;
    type?: string;
    message?: string;
}

interface RealTimeSimulationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartSimulation: (
        modelEntities: any,
        websocket: WebSocket | null,
        updateFunction: (data: any) => void
    ) => void;
    viewerRef: React.RefObject<CesiumComponentRef<Cesium.Viewer>>;
}

interface ModelState {
    model1: File | null;
    model2: File | null;
}

interface ModelEntities {
    model1: Cesium.Model | null;
    model2: Cesium.Model | null;
}

interface RealTimeData {
    model1: {
        longitude: number;
        latitude: number;
        altitude: number;
        yaw: number;
        pitch: number;
        roll: number;
        lastUpdate: number;
    } | null;
    model2: {
        longitude: number;
        latitude: number;
        altitude: number;
        yaw: number;
        pitch: number;
        roll: number;
        lastUpdate: number;
    } | null;
}

const RealTimeSimulationModal: React.FC<RealTimeSimulationModalProps> = ({
    isOpen,
    onClose,
    onStartSimulation,
    viewerRef,
}) => {
    const [models, setModels] = useState<ModelState>({
        model1: null,
        model2: null,
    });

    // 使用useRef来保存模型实体，避免状态更新延迟
    const modelEntitiesRef = useRef<ModelEntities>({
        model1: null,
        model2: null,
    });

    const [isConnected, setIsConnected] = useState(false);
    const websocketRef = useRef<WebSocket | null>(null);
    const wsUrlRef = useRef("ws://localhost:8080");

    // 在组件内部添加数据更新回调状态
    const [dataUpdateCallback, setDataUpdateCallback] = useState<
        ((data: any) => void) | null
    >(null);

    // 在组件状态定义部分添加
    const [isSimulationRunning, setIsSimulationRunning] = useState(false);

    // 在组件状态定义部分添加
    const [realTimeData, setRealTimeData] = useState<RealTimeData | null>(null);

    // 选择模型文件
    const handleModelSelect = (modelId: keyof ModelState) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".glb,.gltf";
        input.onchange = (e: Event) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                const file = target.files[0];
                setModels(prev => ({
                    ...prev,
                    [modelId]: file,
                }));
            }
        };
        input.click();
    };

    // 移除选中的模型
    const removeModel = (modelId: keyof ModelState, e: React.MouseEvent) => {
        e.stopPropagation();
        setModels(prev => ({
            ...prev,
            [modelId]: null,
        }));
    };

    // WebSocket服务器地址变更
    const handleWsUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        wsUrlRef.current = e.target.value;
    };

    // 连接WebSocket服务器
    const connectToServer = () => {
        try {
            console.log(`=== 尝试连接WebSocket服务器: ${wsUrlRef.current} ===`);

            // 创建WebSocket连接
            const ws = new WebSocket(wsUrlRef.current);

            ws.onopen = () => {
                console.log("✅ WebSocket连接成功建立");
                console.log(`🔗 连接地址: ${wsUrlRef.current}`);
                setIsConnected(true);
            };

            ws.onclose = () => {
                console.log("🔌 WebSocket连接已关闭");
                setIsConnected(false);
            };

            ws.onerror = (error: Event) => {
                console.error("❌ WebSocket连接错误:", error);
                alert("服务器连接失败，请检查服务器状态和地址");
                setIsConnected(false);
            };

            websocketRef.current = ws;
        } catch (error) {
            console.error("❌ 创建WebSocket连接时出错:", error);
            alert("无法创建WebSocket连接");
        }
    };

    // 断开WebSocket连接
    const disconnectFromServer = () => {
        if (websocketRef.current) {
            console.log("🔌 主动断开WebSocket连接");
            websocketRef.current.close();
            websocketRef.current = null;
            setIsConnected(false);
        }
    };

    // 加载模型到Cesium场景
    const loadModelsToScene = async (): Promise<boolean> => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) {
            alert("Cesium场景未初始化");
            return false;
        }

        const cesiumViewer = viewerRef.current.cesiumElement;

        try {
            // 加载第一个模型
            if (models.model1) {
                const model1URL = URL.createObjectURL(models.model1);
                const position1 = Cesium.Cartesian3.fromDegrees(
                    116.4,
                    39.9,
                    500
                );

                const model1 = await Cesium.Model.fromGltfAsync({
                    url: model1URL,
                    modelMatrix:
                        Cesium.Transforms.eastNorthUpToFixedFrame(position1),
                    scale: 10.0,
                });

                model1.silhouetteColor = Cesium.Color.YELLOW;
                model1.silhouetteSize = 1.0;
                model1.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
                model1.minimumPixelSize = 42;

                cesiumViewer.scene.primitives.add(model1);
                modelEntitiesRef.current.model1 = model1;

                URL.revokeObjectURL(model1URL);
                console.log("模型1加载完成");
            }

            // 加载第二个模型
            if (models.model2) {
                const model2URL = URL.createObjectURL(models.model2);
                const position2 = Cesium.Cartesian3.fromDegrees(
                    116.4,
                    40.0,
                    500
                );

                const model2 = await Cesium.Model.fromGltfAsync({
                    url: model2URL,
                    modelMatrix:
                        Cesium.Transforms.eastNorthUpToFixedFrame(position2),
                    scale: 10.0,
                });

                model2.silhouetteColor = Cesium.Color.RED;
                model2.silhouetteSize = 1.0;
                model2.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
                model2.minimumPixelSize = 42;

                cesiumViewer.scene.primitives.add(model2);
                modelEntitiesRef.current.model2 = model2;

                URL.revokeObjectURL(model2URL);
                console.log("模型2加载完成");
            }

            console.log("所有模型加载完成");
            return true;
        } catch (error) {
            console.error("加载模型时出错:", error);
            alert(`加载模型失败: ${(error as Error).message}`);
            return false;
        }
    };

    // 更新模型位置和姿态
    const updateModelsPosition = (data: WebSocketData) => {
        console.log("=== 开始更新模型位置 ===");

        if (!viewerRef.current?.cesiumElement) {
            console.log("❌ Cesium viewer 未初始化");
            return;
        }

        if (!data.model1 && !data.model2) {
            console.log("❌ 数据中没有模型信息");
            return;
        }

        // 更新模型1
        if (modelEntitiesRef.current.model1 && data.model1) {
            console.log("🚀 === 模型1六自由度数据 ===");
            console.log(`📍 位置信息:`);
            console.log(`   经度: ${data.model1.longitude}°`);
            console.log(`   纬度: ${data.model1.latitude}°`);
            console.log(`   高度: ${data.model1.altitude}m`);
            console.log(`🎯 姿态信息:`);
            console.log(`   偏航角(Yaw): ${data.model1.yaw}°`);
            console.log(`   俯仰角(Pitch): ${data.model1.pitch}°`);
            console.log(`   横滚角(Roll): ${data.model1.roll}°`);

            const position = Cesium.Cartesian3.fromDegrees(
                data.model1.longitude,
                data.model1.latitude,
                data.model1.altitude
            );

            const hpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(data.model1.yaw),
                Cesium.Math.toRadians(data.model1.pitch),
                Cesium.Math.toRadians(data.model1.roll)
            );

            const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
                position,
                hpr
            );

            modelEntitiesRef.current.model1.modelMatrix = modelMatrix;
        }

        // 更新模型2
        if (modelEntitiesRef.current.model2 && data.model2) {
            console.log("🚁 === 模型2六自由度数据 ===");
            console.log(`📍 位置信息:`);
            console.log(`   经度: ${data.model2.longitude}°`);
            console.log(`   纬度: ${data.model2.latitude}°`);
            console.log(`   高度: ${data.model2.altitude}m`);
            console.log(`🎯 姿态信息:`);
            console.log(`   偏航角(Yaw): ${data.model2.yaw}°`);
            console.log(`   俯仰角(Pitch): ${data.model2.pitch}°`);
            console.log(`   横滚角(Roll): ${data.model2.roll}°`);

            const position = Cesium.Cartesian3.fromDegrees(
                data.model2.longitude,
                data.model2.latitude,
                data.model2.altitude
            );

            const hpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(data.model2.yaw),
                Cesium.Math.toRadians(data.model2.pitch),
                Cesium.Math.toRadians(data.model2.roll)
            );

            const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(
                position,
                hpr
            );

            modelEntitiesRef.current.model2.modelMatrix = modelMatrix;
        }

        console.log("🔄 模型位置更新完成");
    };

    // 开始实时仿真
    const startRealTimeSimulation = async () => {
        if (!models.model1 && !models.model2) {
            alert("请至少选择一个模型");
            return;
        }

        if (!isConnected) {
            alert("请先连接WebSocket服务器");
            return;
        }

        // 首先加载模型到场景
        const modelsLoaded = await loadModelsToScene();
        if (!modelsLoaded) {
            return;
        }

        setIsSimulationRunning(true);

        // 传递模型实体和更新函数给 FirstPage
        onStartSimulation(
            modelEntitiesRef.current,
            websocketRef.current,
            updateModelsPosition // 传递更新函数
        );

        // 关闭模态框
        onClose();
    };

    // 添加停止仿真函数
    const stopRealTimeSimulation = () => {
        setIsSimulationRunning(false);

        // 清除WebSocket消息监听
        if (websocketRef.current) {
            websocketRef.current.onmessage = null;
        }

        // 清除数据更新回调
        setDataUpdateCallback(null);

        // 移除场景中的模型
        if (viewerRef.current?.cesiumElement) {
            const cesiumViewer = viewerRef.current.cesiumElement;

            if (modelEntitiesRef.current.model1) {
                cesiumViewer.scene.primitives.remove(
                    modelEntitiesRef.current.model1
                );
                modelEntitiesRef.current.model1 = null;
            }

            if (modelEntitiesRef.current.model2) {
                cesiumViewer.scene.primitives.remove(
                    modelEntitiesRef.current.model2
                );
                modelEntitiesRef.current.model2 = null;
            }
        }
    };

    // 如果弹窗未打开，不渲染任何内容
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="realtime-modal">
                <div className="modal-header">
                    <h3>实时仿真设置</h3>
                    <button className="close-btn" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="modal-body">
                    <div className="model-selection">
                        <h4>选择模型 (最多两个)</h4>

                        <div className="model-grid">
                            <div className="model-slot">
                                <div
                                    className="model-box"
                                    onClick={() => handleModelSelect("model1")}
                                >
                                    {models.model1 ? (
                                        <div className="model-preview">
                                            <div className="model-filename">
                                                {models.model1.name}
                                            </div>
                                            <button
                                                className="remove-model"
                                                onClick={e =>
                                                    removeModel("model1", e)
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="model-placeholder">
                                            <div className="add-icon">+</div>
                                            <div>点击选择模型</div>
                                        </div>
                                    )}
                                </div>
                                <div className="model-label">模型 1</div>
                            </div>

                            <div className="model-slot">
                                <div
                                    className="model-box"
                                    onClick={() => handleModelSelect("model2")}
                                >
                                    {models.model2 ? (
                                        <div className="model-preview">
                                            <div className="model-filename">
                                                {models.model2.name}
                                            </div>
                                            <button
                                                className="remove-model"
                                                onClick={e =>
                                                    removeModel("model2", e)
                                                }
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="model-placeholder">
                                            <div className="add-icon">+</div>
                                            <div>点击选择模型</div>
                                        </div>
                                    )}
                                </div>
                                <div className="model-label">模型 2</div>
                            </div>
                        </div>
                    </div>

                    <div className="server-connection">
                        <h4>WebSocket服务器连接</h4>
                        <div className="server-input">
                            <input
                                type="text"
                                defaultValue={wsUrlRef.current}
                                onChange={handleWsUrlChange}
                                placeholder="ws://localhost:8080"
                                disabled={isConnected}
                            />
                        </div>
                        <button
                            className={`connect-btn ${
                                isConnected ? "connected" : ""
                            }`}
                            onClick={
                                isConnected
                                    ? disconnectFromServer
                                    : connectToServer
                            }
                        >
                            {isConnected ? "断开连接" : "连接服务器"}
                        </button>
                        <div className="connection-status">
                            状态:{" "}
                            <span
                                className={
                                    isConnected
                                        ? "connected-text"
                                        : "disconnected-text"
                                }
                            >
                                {isConnected ? "已连接" : "未连接"}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="cancel-btn" onClick={onClose}>
                        取消
                    </button>
                    {!isSimulationRunning ? (
                        <button
                            className="start-btn"
                            onClick={startRealTimeSimulation}
                            disabled={
                                !isConnected ||
                                (!models.model1 && !models.model2)
                            }
                        >
                            开始实时仿真
                        </button>
                    ) : (
                        <button
                            className="stop-btn"
                            onClick={stopRealTimeSimulation}
                        >
                            停止仿真
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RealTimeSimulationModal;
