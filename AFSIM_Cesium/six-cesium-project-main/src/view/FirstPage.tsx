import { useRef, useState, useEffect } from "react";
import "./FirstPage.css";
import { Viewer } from "resium";
import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { ak, BEIJING_POSITION, SHANGHAI_POSITION } from "../config/data.js";
import * as XLSX from "xlsx";
// import { RealTimeTrajectory } from "./RealTimeTrajectory.js";
import ClassComponent from "./ClassComponent.js";
import { CesiumComponentRef } from "resium";
import { performanceOptimizer } from "../utils/performanceOptimization";
import LCPOptimizer from "../components/LCPOptimizer";
import PerformanceDashboard from "../components/PerformanceDashboard";

// 移除懒加载，直接导入模态框组件
import SimulationConfigModal from "./SimulationConfigModal.tsx";
import { ModelSelectionModal } from "./ModelSelectionModal.js";
import { ModelTypeModal } from "./ModelType.js";
import RealTimeSimulationModal from "./RealTimeSimulationModal.tsx";

function FirstPage() {
    Cesium.Ion.defaultAccessToken = ak;
    // 在FirstPage组件中修改状态
    const [models, setModels] = useState({
        model1: null,
        model2: null,
        model3: null,
        model4: null,
        model5: null,
        model6: null,
        model7: null,
        model8: null,
    });

    const [modelFiles, setModelFiles] = useState({
        model1: null,
        model2: null,
        model3: null,
        model4: null,
        model5: null,
        model6: null,
        model7: null,
        model8: null,
    });

    const [offsets, setOffsets] = useState({
        model1: { yaw: 0, pitch: 0, roll: 0 },
        model2: { yaw: 0, pitch: 0, roll: 0 },
        model3: { yaw: 0, pitch: 0, roll: 0 },
        model4: { yaw: 0, pitch: 0, roll: 0 },
        model5: { yaw: 0, pitch: 0, roll: 0 },
        model6: { yaw: 0, pitch: 0, roll: 0 },
        model7: { yaw: 0, pitch: 0, roll: 0 },
        model8: { yaw: 0, pitch: 0, roll: 0 },
    });

    const modelPathPositionsRef = useRef({
        model1: [],
        model2: [],
        model3: [],
        model4: [],
        model5: [],
        model6: [],
        model7: [],
        model8: [],
    });
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [simulationConfigs, setSimulationConfigs] = useState([]);
    const [activeConfigIndex, setActiveConfigIndex] = useState(0);
    const [showModelTypeModal, setShowModelTypeModal] = useState(false);
    const position1 = BEIJING_POSITION;
    const position2 = SHANGHAI_POSITION;

    const [sixDofData, setSixDofData] = useState([]);
    const [speedMultiplier, setSpeedMultiplier] = useState(1);
    const [isPlaying, setIsPlaying] = useState(false);
    const targetPathPositionsRef = useRef([]);
    const missilePathPositionsRef = useRef([]);
    const [showModelModal, setShowModelModal] = useState(false);
    const [currentModelType, setCurrentModelType] = useState(null);
    // Add to your state

    const viewerRef = useRef(null);

    const animationDataRef = useRef(null);
    const startTimeRef = useRef(null);
    const animationFrameIdRef = useRef(null);
    const pathEntityRef = useRef(null);

    const [activeModel, setActiveModel] = useState("target"); // 'target' or 'missile'

    // // 使用实时轨迹组件
    // const { isRealTime, connectWebSocket } = RealTimeTrajectory({
    //     viewerRef,
    //     models,
    //     setModels,
    // });
    // // 在FirstPage组件中添加以下状态和函数

    const [manualAdjustments, setManualAdjustments] = useState({
        yaw: 0,
        pitch: 0,
        roll: 0,
    });

    // 在状态部分添加选中模型的高亮状态
    const [activeModelEntity, setActiveModelEntity] = useState(null);

    // 从localStorage加载保存的姿态校正
    const loadSavedAdjustments = modelId => {
        const saved = localStorage.getItem(`model_adjustments_${modelId}`);
        if (saved) {
            return JSON.parse(saved);
        }
        return { yaw: 0, pitch: 0, roll: 0 };
    };

    // 保存姿态校正到localStorage
    const saveAdjustments = (modelId, adjustments) => {
        localStorage.setItem(
            `model_adjustments_${modelId}`,
            JSON.stringify(adjustments)
        );
    };

    // 修改adjustYaw、adjustPitch、adjustRoll函数
    const adjustYaw = degrees => {
        const newOffsets = {
            ...offsets,
            [activeModel]: {
                ...offsets[activeModel],
                yaw: (offsets[activeModel]?.yaw || 0) + degrees,
            },
        };
        setOffsets(newOffsets);
        saveAdjustments(activeModel, newOffsets[activeModel]);
    };

    const adjustPitch = degrees => {
        const newOffsets = {
            ...offsets,
            [activeModel]: {
                ...offsets[activeModel],
                pitch: (offsets[activeModel]?.pitch || 0) + degrees,
            },
        };
        setOffsets(newOffsets);
        saveAdjustments(activeModel, newOffsets[activeModel]);
    };

    const adjustRoll = degrees => {
        const newOffsets = {
            ...offsets,
            [activeModel]: {
                ...offsets[activeModel],
                roll: (offsets[activeModel]?.roll || 0) + degrees,
            },
        };
        setOffsets(newOffsets);
        saveAdjustments(activeModel, newOffsets[activeModel]);
    };

    // 修改resetOrientation函数
    const resetOrientation = () => {
        const newOffsets = {
            ...offsets,
            [activeModel]: { yaw: 0, pitch: 0, roll: 0 },
        };
        setOffsets(newOffsets);
        saveAdjustments(activeModel, newOffsets[activeModel]);

        if (models[activeModel]) {
            const model = models[activeModel];
            const position = Cesium.Matrix4.getTranslation(
                model.modelMatrix,
                new Cesium.Cartesian3()
            );

            const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(
                new Cesium.HeadingPitchRoll(0, 0, 0)
            );

            model.modelMatrix =
                Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                    position,
                    quaternion,
                    new Cesium.Cartesian3(1.0, 1.0, 1.0)
                );
        }
    };

    // 添加手动输入调整值的函数
    const handleManualAdjustment = (axis, value) => {
        const numValue = parseFloat(value) || 0;
        const newAdjustments = {
            ...manualAdjustments,
            [axis]: numValue,
        };
        setManualAdjustments(newAdjustments);
    };

    // 修改选择模型的函数
    const selectModel = modelId => {
        // 移除之前选中模型的高亮效果
        if (activeModelEntity && models[activeModel]) {
            models[activeModel].silhouetteColor = Cesium.Color.WHITE;
            models[activeModel].silhouetteSize = 0.0;
        }

        // 设置新选中的模型
        setActiveModel(modelId);

        // 加载该模型已保存的姿态调整值
        const savedAdjustment = loadSavedAdjustments(modelId);
        setManualAdjustments({
            yaw: savedAdjustment.yaw || 0,
            pitch: savedAdjustment.pitch || 0,
            roll: savedAdjustment.roll || 0,
        });

        // 高亮显示选中的模型
        if (models[modelId]) {
            models[modelId].silhouetteColor = Cesium.Color.GOLD;
            models[modelId].silhouetteSize = 2.0;
            setActiveModelEntity(models[modelId]);

            // 将相机移动到模型位置
            if (viewerRef.current?.cesiumElement) {
                const modelPosition = Cesium.Matrix4.getTranslation(
                    models[modelId].modelMatrix,
                    new Cesium.Cartesian3()
                );

                viewerRef.current.cesiumElement.camera.flyTo({
                    destination: Cesium.Cartesian3.add(
                        modelPosition,
                        new Cesium.Cartesian3(0, -100, 50),
                        new Cesium.Cartesian3()
                    ),
                    orientation: {
                        heading: Cesium.Math.toRadians(0),
                        pitch: Cesium.Math.toRadians(-20),
                        roll: 0,
                    },
                    duration: 1.0,
                });
            }
        }
    };

    // 修改应用手动输入的调整值函数
    const applyManualAdjustment = () => {
        const newOffsets = {
            ...offsets,
            [activeModel]: {
                yaw: manualAdjustments.yaw,
                pitch: manualAdjustments.pitch,
                roll: manualAdjustments.roll,
            },
        };
        setOffsets(newOffsets);
        saveAdjustments(activeModel, newOffsets[activeModel]);

        // 立即应用姿态到模型
        if (models[activeModel]) {
            const model = models[activeModel];
            const position = Cesium.Matrix4.getTranslation(
                model.modelMatrix,
                new Cesium.Cartesian3()
            );

            // 计算旋转矩阵
            const hpr = new Cesium.HeadingPitchRoll(
                Cesium.Math.toRadians(manualAdjustments.yaw),
                Cesium.Math.toRadians(manualAdjustments.pitch),
                Cesium.Math.toRadians(manualAdjustments.roll)
            );

            const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);

            // 更新模型矩阵
            model.modelMatrix =
                Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                    position,
                    quaternion,
                    new Cesium.Cartesian3(1.0, 1.0, 1.0)
                );
        }
    };

    // 在组件初始化时加载保存的姿态
    useEffect(() => {
        // 加载保存的姿态校正
        const savedOffsets = {};
        for (let i = 1; i <= 8; i++) {
            const modelId = `model${i}`;
            savedOffsets[modelId] = loadSavedAdjustments(modelId);
        }
        setOffsets(savedOffsets);

        // 初始化性能优化器
        performanceOptimizer.init();

        return () => {
            // 清理性能优化器
            performanceOptimizer.cleanup();
        };
    }, []);

    const loadModel = async (file, modelId = "model1") => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) {
            console.error("Viewer未初始化!");
            return;
        }

        // 更新模型文件名记录
        setModelFiles(prev => ({
            ...prev,
            [modelId]: file.name,
        }));

        const url = URL.createObjectURL(file);
        const cesiumViewer = viewerRef.current.cesiumElement;

        try {
            // 移除旧模型
            if (models[modelId]) {
                cesiumViewer.scene.primitives.remove(models[modelId]);
            }

            // 初始化位置 - 从动画数据中获取
            let initialPosition;
            if (
                animationDataRef.current &&
                animationDataRef.current.length > 0 &&
                animationDataRef.current[0].positions[modelId]
            ) {
                const pos = animationDataRef.current[0].positions[modelId];
                initialPosition = Cesium.Cartesian3.fromDegrees(
                    pos.x,
                    pos.y,
                    pos.z
                );
            } else {
                // 默认位置作为备选
                initialPosition = Cesium.Cartesian3.fromDegrees(
                    116.3 + Math.random() * 0.1, // 随机位置防止重叠
                    39.9 + Math.random() * 0.1,
                    500
                );
            }

            const model = await Cesium.Model.fromGltfAsync({
                url: url,
                modelMatrix:
                    Cesium.Transforms.eastNorthUpToFixedFrame(initialPosition),
                scale: 10.0,
            });

            // 设置模型属性...
            model.silhouetteColor = Cesium.Color.GOLD;
            model.silhouetteSize = 1.0;
            model.colorBlendMode = Cesium.ColorBlendMode.MIX;
            model.depthTestAgainstTerrain = false;
            model.colorBlendMode = Cesium.ColorBlendMode.HIGHLIGHT;
            model.maximumScale = 200000;
            model.minimumPixelSize = 42;
            cesiumViewer.scene.primitives.add(model);

            // 更新模型引用
            setModels(prev => ({
                ...prev,
                [modelId]: model,
            }));

            // 检查是否有保存的姿态设置
            const savedOrientation = localStorage.getItem(
                `model_orientation_${file.name}`
            );

            if (savedOrientation) {
                // 应用保存的姿态
                const orientationData = JSON.parse(savedOrientation);

                // 更新偏移量
                setOffsets(prev => ({
                    ...prev,
                    [modelId]: {
                        yaw: orientationData.yaw || 0,
                        pitch: orientationData.pitch || 0,
                        roll: orientationData.roll || 0,
                    },
                }));

                // 直接应用保存的姿态角
                const hpr = new Cesium.HeadingPitchRoll(
                    Cesium.Math.toRadians(orientationData.yaw || 0),
                    Cesium.Math.toRadians(orientationData.pitch || 0),
                    Cesium.Math.toRadians(orientationData.roll || 0)
                );

                const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);

                model.modelMatrix =
                    Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                        initialPosition,
                        quaternion,
                        new Cesium.Cartesian3(1.0, 1.0, 1.0)
                    );

                console.log(`已应用保存的模型"${file.name}"姿态设置`);
            } else if (
                animationDataRef.current &&
                animationDataRef.current.length > 0 &&
                animationDataRef.current[0].orientations[modelId]
            ) {
                // 如果没有保存的姿态，但有轨迹姿态数据，则应用轨迹姿态
                const orientation =
                    animationDataRef.current[0].orientations[modelId];
                updateModel(
                    model,
                    animationDataRef.current[0].positions[modelId],
                    orientation,
                    modelId
                );
            }
        } catch (error) {
            console.error("加载模型时出错:", error);
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    // 添加创建默认模型的函数
    const createDefaultModel = async (modelType, position) => {
        if (!viewerRef.current || !viewerRef.current.cesiumElement) return;

        const cesiumViewer = viewerRef.current.cesiumElement;
        const initialPosition = Cesium.Cartesian3.fromDegrees(
            position.x,
            position.y,
            position.z
        );

        try {
            // 使用Cesium内置的模型作为默认模型
            const model = await Cesium.Model.fromGltfAsync({
                url: Cesium.IonResource.fromAssetId(3878), // Cesium内置的飞机模型
                modelMatrix:
                    Cesium.Transforms.eastNorthUpToFixedFrame(initialPosition),
                scale: 10.0,
            });

            model.silhouetteColor =
                modelType === "target" ? Cesium.Color.YELLOW : Cesium.Color.RED;
            model.silhouetteSize = 1.0;
            model.colorBlendMode = Cesium.ColorBlendMode.MIX;
            model.depthTestAgainstTerrain = false;
            model.maximumScale = 200000;
            model.minimumPixelSize = 42;

            cesiumViewer.scene.primitives.add(model);

            // 更新模型引用
            setModels(prev => ({
                ...prev,
                [modelType]: model,
            }));
        } catch (error) {
            console.error("Error creating default model:", error);
        }
        const initialOrientation = { yaw: 0, pitch: 0, roll: 0 };
        updateModel(model, position, initialOrientation, modelType);
    };

    const prepareAnimation = () => {
        if (!viewerRef.current || !animationDataRef.current) return;

        const cesiumViewer = viewerRef.current.cesiumElement;

        // 清除之前的路径
        if (pathEntityRef.current) {
            pathEntityRef.current.forEach(entity =>
                cesiumViewer.entities.remove(entity)
            );
        }

        // 为每个模型创建路径实体
        pathEntityRef.current = [];
        const colors = [
            Cesium.Color.YELLOW,
            Cesium.Color.RED,
            Cesium.Color.BLUE,
            Cesium.Color.GREEN,
            Cesium.Color.PURPLE,
            Cesium.Color.ORANGE,
            Cesium.Color.CYAN,
            Cesium.Color.PINK,
        ];

        for (let i = 1; i <= 8; i++) {
            const modelId = `model${i}`;
            pathEntityRef.current.push(
                cesiumViewer.entities.add({
                    name: `${modelId} Path`,
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            return modelPathPositionsRef.current[modelId] || [];
                        }, false),
                        width: 2,
                        material: new Cesium.PolylineGlowMaterialProperty({
                            glowPower: 0.2,
                            color: colors[i - 1],
                        }),
                    },
                })
            );
        }

        // 初始化路径点数组
        for (let i = 1; i <= 8; i++) {
            modelPathPositionsRef.current[`model${i}`] = [];
        }
    };

    const startAnimation = () => {
        if (!viewerRef.current || !animationDataRef.current) return;

        const data = animationDataRef.current;
        if (data.length === 0) return;

        // 初始化所有模型位置
        for (let i = 1; i <= 8; i++) {
            const modelId = `model${i}`;
            if (models[modelId] && data[0]?.positions[modelId]) {
                const initialPos = data[0].positions[modelId];
                const initialOri = data[0].orientations[modelId];
                updateModel(models[modelId], initialPos, initialOri, modelId);

                modelPathPositionsRef.current[modelId] = [
                    Cesium.Cartesian3.fromDegrees(
                        initialPos.x,
                        initialPos.y,
                        initialPos.z
                    ),
                ];
            }
        }

        setIsPlaying(true);
        startTimeRef.current = performance.now();

        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
        }

        const animate = () => {
            const elapsed =
                (performance.now() - startTimeRef.current) * speedMultiplier;
            const totalDuration = data[data.length - 1].time;

            if (elapsed >= totalDuration) {
                stopAnimation();
                return;
            }

            let currentTime = elapsed;
            let currentIndex = 0;
            for (let i = 0; i < data.length; i++) {
                if (data[i].time > currentTime) break;
                currentIndex = i;
            }

            const nextIndex = Math.min(currentIndex + 1, data.length - 1);
            const prevData = data[currentIndex];
            const nextData = data[nextIndex];
            const timeRange = nextData.time - prevData.time;
            const ratio =
                timeRange > 0 ? (currentTime - prevData.time) / timeRange : 0;

            // 更新所有模型
            for (let i = 1; i <= 8; i++) {
                const modelId = `model${i}`;
                if (
                    models[modelId] &&
                    prevData.positions[modelId] &&
                    nextData.positions[modelId]
                ) {
                    const modelPos = interpolatePosition(
                        prevData.positions[modelId],
                        nextData.positions[modelId],
                        ratio
                    );
                    const modelOri = interpolateOrientation(
                        prevData.orientations[modelId],
                        nextData.orientations[modelId],
                        ratio
                    );
                    updateModel(models[modelId], modelPos, modelOri, modelId);

                    // 添加到路径
                    const newPos = Cesium.Cartesian3.fromDegrees(
                        modelPos.x,
                        modelPos.y,
                        modelPos.z
                    );
                    const currentPath = modelPathPositionsRef.current[modelId];
                    if (
                        !currentPath.length ||
                        !Cesium.Cartesian3.equals(
                            newPos,
                            currentPath[currentPath.length - 1]
                        )
                    ) {
                        modelPathPositionsRef.current[modelId] = [
                            ...currentPath,
                            newPos,
                        ];
                    }
                }
            }

            animationFrameIdRef.current = requestAnimationFrame(animate);
        };

        animationFrameIdRef.current = requestAnimationFrame(animate);
    };

    // 停止动画
    const stopAnimation = () => {
        if (animationFrameIdRef.current) {
            cancelAnimationFrame(animationFrameIdRef.current);
            animationFrameIdRef.current = null;
        }
        setIsPlaying(false);
    };

    // 处理速度变化
    useEffect(() => {
        // 如果动画正在播放，重新开始以应用新的速度
        if (isPlaying) {
            stopAnimation();
            startAnimation();
        }
    }, [speedMultiplier]);

    // 组件卸载时清理
    useEffect(() => {
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, []);

    // 调整速度
    const adjustSpeed = multiplier => {
        setSpeedMultiplier(multiplier);
    };

    // Helper functions
    const interpolatePosition = (prevPos, nextPos, ratio) => {
        return {
            x: Cesium.Math.lerp(prevPos.x, nextPos.x, ratio),
            y: Cesium.Math.lerp(prevPos.y, nextPos.y, ratio),
            z: Cesium.Math.lerp(prevPos.z, nextPos.z, ratio),
        };
    };

    const interpolateOrientation = (prevOri, nextOri, ratio) => {
        return {
            roll: Cesium.Math.lerp(prevOri.roll, nextOri.roll, ratio),
            pitch: Cesium.Math.lerp(prevOri.pitch, nextOri.pitch, ratio),
            yaw: Cesium.Math.lerp(prevOri.yaw, nextOri.yaw, ratio),
        };
    };

    // 修改updateModel函数，加入姿态调整
    const updateModel = (model, position, orientation, modelType) => {
        if (!model) return;

        const cartesianPos = Cesium.Cartesian3.fromDegrees(
            position.x,
            position.y,
            position.z
        );

        // 获取当前模型的偏移量
        const currentOffsets = offsets[modelType] || {
            yaw: 0,
            pitch: 0,
            roll: 0,
        };

        // 应用偏移量到方向，合并轨迹中的姿态和用户设置的偏移
        const hpr = new Cesium.HeadingPitchRoll(
            Cesium.Math.toRadians(orientation.yaw + currentOffsets.yaw),
            Cesium.Math.toRadians(orientation.pitch + currentOffsets.pitch),
            Cesium.Math.toRadians(orientation.roll + currentOffsets.roll)
        );

        const quaternion = Cesium.Quaternion.fromHeadingPitchRoll(hpr);

        model.modelMatrix =
            Cesium.Matrix4.fromTranslationQuaternionRotationScale(
                cartesianPos,
                quaternion,
                new Cesium.Cartesian3(1.0, 1.0, 1.0)
            );
    };

    const handleSelectExistingModel = () => {
        setShowModelModal(false);
        setShowModelTypeModal(true);
    };

    const handleSelectLocalModel = () => {
        setShowModelModal(false);
        // 创建文件输入元素
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".glb,.gltf";
        input.onchange = e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                loadModel(file, activeModel);
            }
        };
        input.click();
    };

    const handleSelectModelType = async modelType => {
        setShowModelTypeModal(false);

        if (!currentModelType || !viewerRef.current) return;

        try {
            // 方法1：使用绝对路径（推荐）
            const modelUrl = `${window.location.origin}/localModel/${modelType}.glb`;
            console.log("尝试加载模型:", modelUrl); // 调试用

            // 直接使用URL加载，不转换为File对象
            await loadModelFromUrl(modelUrl, currentModelType);
        } catch (error) {
            console.error("模型加载失败:", error);
            // 回退到Cesium默认模型
            const position =
                currentModelType === "target" ? position1 : position2;
            createDefaultModel(currentModelType, {
                x: position.longitude,
                y: position.latitude,
                z: currentModelType === "target" ? 500 : 1000,
            });
            alert(`模型加载失败，已使用默认模型代替\n错误: ${error.message}`);
        }
    };

    // 新增的URL加载方法
    const loadModelFromUrl = async (url, modelType) => {
        if (!viewerRef.current?.cesiumElement) {
            throw new Error("Cesium viewer未初始化");
        }

        const cesiumViewer = viewerRef.current.cesiumElement;

        // 移除旧模型
        if (models[modelType]) {
            cesiumViewer.scene.primitives.remove(models[modelType]);
        }

        // 使用Cesium的fromGltfAsync直接加载URL
        const model = await Cesium.Model.fromGltfAsync({
            url: url,
            modelMatrix: Cesium.Matrix4.IDENTITY,
            scale: 10.0,
        });

        // 设置模型属性
        model.silhouetteColor =
            modelType === "target" ? Cesium.Color.YELLOW : Cesium.Color.RED;
        model.silhouetteSize = 1.0;
        model.minimumPixelSize = 64;

        cesiumViewer.scene.primitives.add(model);

        // 更新模型引用
        setModels(prev => ({
            ...prev,
            [modelType]: model,
        }));

        // 初始化位置
        const initialPos =
            animationDataRef.current?.[0]?.[`${modelType}Position`] ||
            (modelType === "target" ? position1 : position2);

        const cartesianPos = Cesium.Cartesian3.fromDegrees(
            initialPos.x || initialPos.longitude,
            initialPos.y || initialPos.latitude,
            initialPos.z || (modelType === "target" ? 500 : 1000)
        );
        model.modelMatrix = Cesium.Matrix4.fromTranslation(cartesianPos);
    };

    const hoverModel = () => {
        let container = document.querySelector(".model-list-container");
        if (!container) {
            container = document.createElement("div");
            container.className = "model-list-container";
            document.body.appendChild(container);

            document.addEventListener("click", e => {
                if (
                    !container.contains(e.target) &&
                    e.target.className !== "tool-btn"
                ) {
                    container.style.display = "none";
                }
            });
        }

        container.style.display =
            container.style.display === "none" ? "block" : "none";

        container.innerHTML = `
            <h3 class="model-list-title">已加载模型</h3>
            <ul class="model-list">
                ${Object.entries(modelFiles)
                    .filter(([_, name]) => name)
                    .map(([id, name]) => `<li>${id}: ${name}</li>`)
                    .join("")}
            </ul>
        `;
    };
    const parseTrajectoryFile = async file => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: "array" });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);

                    let startTime = null;
                    const parsedData = jsonData.map((row, index) => {
                        const timestamp = row.time * 1000 || index * 100;
                        if (index === 0) startTime = timestamp;

                        return {
                            time: timestamp - startTime,
                            positions: {
                                model1: {
                                    x: row.P_Target_L || row.longitude || 0,
                                    y: row.P_Target_B || row.latitude || 0,
                                    z: row.P_Target_H || row.height || 0,
                                },
                                model2: {
                                    x: row.P_Missile_L || row.longitude2 || 0,
                                    y: row.P_Missile_B || row.latitude2 || 0,
                                    z: row.P_Missile_H || row.height2 || 0,
                                },
                            },
                            orientations: {
                                model1: {
                                    // 优先使用原始姿态数据，没有则使用0
                                    roll: parseFloat(row.roll || row.Roll || 0),
                                    pitch: parseFloat(
                                        row.pitch || row.Pitch || 0
                                    ),
                                    yaw: parseFloat(
                                        row.yaw || row.Yaw || row.heading || 0
                                    ),
                                },
                                model2: {
                                    roll: parseFloat(
                                        row.missile_roll || row.Roll || 0
                                    ),
                                    pitch: parseFloat(
                                        row.missile_pitch || row.Pitch || 0
                                    ),
                                    yaw: parseFloat(
                                        row.missile_yaw ||
                                            row.Yaw ||
                                            row.heading ||
                                            0
                                    ),
                                },
                            },
                        };
                    });

                    resolve(parsedData);
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    };
    const combineTrajectoryData = trajectories => {
        if (trajectories.length === 1) return trajectories[0];

        // 找到最长的轨迹作为基准
        const maxLength = Math.max(...trajectories.map(t => t.length));
        const combinedData = [];

        for (let i = 0; i < maxLength; i++) {
            const combinedFrame = {
                time: i * 100, // 假设每帧100ms
                positions: {},
                orientations: {},
            };

            // 合并所有轨迹的当前帧
            trajectories.forEach((trajectory, idx) => {
                const frame = trajectory[Math.min(i, trajectory.length - 1)];

                // 为每个模型组分配不同的模型ID
                const model1Id = `model${idx * 2 + 1}`;
                const model2Id = `model${idx * 2 + 2}`;

                // 使用轨迹中的模型数据
                combinedFrame.positions[model1Id] = frame.positions.model1 || {
                    x: 0,
                    y: 0,
                    z: 0,
                };
                combinedFrame.orientations[model1Id] = frame.orientations
                    .model1 || { roll: 0, pitch: 0, yaw: 0 };

                combinedFrame.positions[model2Id] = frame.positions.model2 || {
                    x: 0,
                    y: 0,
                    z: 0,
                };
                combinedFrame.orientations[model2Id] = frame.orientations
                    .model2 || { roll: 0, pitch: 0, yaw: 0 };
            });

            combinedData.push(combinedFrame);
        }

        return combinedData;
    };
    const loadConfiguration = async configs => {
        try {
            // 加载所有轨迹数据先获取初始位置
            const allTrajectoryData = await Promise.all(
                configs
                    .filter(config => config.trajectoryFile)
                    .map(config => parseTrajectoryFile(config.trajectoryFile))
            );

            // 合并所有轨迹数据
            let combinedData = [];
            if (allTrajectoryData.length > 0) {
                combinedData = combineTrajectoryData(allTrajectoryData);
                setSixDofData(combinedData);
                animationDataRef.current = combinedData;
            }

            // 初始化位置信息
            let firstModelPosition = null;

            // 加载所有模型并设置初始位置
            for (let i = 0; i < configs.length; i++) {
                const config = configs[i];
                const model1Id = `model${i * 2 + 1}`;
                const model2Id = `model${i * 2 + 2}`;

                // 从轨迹数据中获取初始位置
                if (combinedData.length > 0) {
                    const firstFrame = combinedData[0];

                    // 加载目标模型并设置位置
                    if (
                        config.targetModelFile &&
                        firstFrame.positions[model1Id]
                    ) {
                        await loadModel(config.targetModelFile, model1Id);

                        // 记录第一个模型的位置用于相机定位
                        if (firstModelPosition === null) {
                            firstModelPosition = firstFrame.positions[model1Id];
                        }
                    }

                    // 加载导弹模型并设置位置
                    if (
                        config.missileModelFile &&
                        firstFrame.positions[model2Id]
                    ) {
                        await loadModel(config.missileModelFile, model2Id);
                    }
                } else {
                    // 没有轨迹数据时，使用默认位置
                    if (config.targetModelFile) {
                        await loadModel(config.targetModelFile, model1Id);
                    }
                    if (config.missileModelFile) {
                        await loadModel(config.missileModelFile, model2Id);
                    }
                }
            }

            // 准备动画路径
            if (combinedData.length > 0) {
                prepareAnimation();

                // 相机飞行到第一个模型位置
                if (firstModelPosition && viewerRef.current?.cesiumElement) {
                    const destination = Cesium.Cartesian3.fromDegrees(
                        firstModelPosition.x,
                        firstModelPosition.y,
                        firstModelPosition.z + 1000 // 高度增加1000米以便观察
                    );

                    viewerRef.current.cesiumElement.camera.flyTo({
                        destination: destination,
                        orientation: {
                            heading: 0.0,
                            pitch: -Math.PI / 4, // 俯视角度
                            roll: 0.0,
                        },
                        duration: 2.0, // 飞行时间2秒
                    });
                }
            }
        } catch (error) {
            console.error("加载配置时出错:", error);
        }
    };
    const toggleAnimation = () => {
        if (isPlaying) {
            stopAnimation();
        } else {
            // 重置所有路径
            for (let i = 1; i <= 8; i++) {
                modelPathPositionsRef.current[`model${i}`] = [];
            }

            startAnimation();
        }
    };

    // 添加保存模型姿态的函数
    const saveModelOrientation = () => {
        // 获取当前模型的文件名作为标识
        const modelFileName = modelFiles[activeModel];
        if (!modelFileName) {
            alert("当前没有选中有效模型，无法保存姿态设置");
            return;
        }

        // 使用模型文件名作为键保存姿态角
        const orientationData = {
            yaw: manualAdjustments.yaw,
            pitch: manualAdjustments.pitch,
            roll: manualAdjustments.roll,
            modelId: activeModel,
        };

        // 保存到localStorage
        localStorage.setItem(
            `model_orientation_${modelFileName}`,
            JSON.stringify(orientationData)
        );

        // 提示用户
        alert(`已保存模型"${modelFileName}"的姿态设置`);
    };

    // 添加一个状态用于控制姿态面板的显示/隐藏
    const [showAttitudePanel, setShowAttitudePanel] = useState(false);

    // 切换姿态面板显示/隐藏的函数
    const toggleAttitudePanel = () => {
        setShowAttitudePanel(!showAttitudePanel);
    };

    // 在FirstPage组件中添加状态
    const [showRealTimeModal, setShowRealTimeModal] = useState(false);
    const [isRealTimeActive, setIsRealTimeActive] = useState(false);
    const [realTimeData, setRealTimeData] = useState(null);
    const [realTimeModels, setRealTimeModels] = useState({
        model1: null,
        model2: null,
    });
    const [showPerformanceDashboard, setShowPerformanceDashboard] =
        useState(false);
    const websocketRef = useRef(null);

    // 在 FirstPage 组件中添加实时数据状态
    const [realTimeWebSocket, setRealTimeWebSocket] = useState(null);

    // 修改 handleStartRealTimeSimulation 函数
    const handleStartRealTimeSimulation = (
        modelEntities,
        websocket,
        updateModelsFunction
    ) => {
        setRealTimeModels(modelEntities);
        setIsRealTimeActive(true);
        setRealTimeWebSocket(websocket);

        // 设置WebSocket消息监听，同时处理模型更新和数据显示
        if (websocket) {
            websocket.onmessage = event => {
                try {
                    const data = JSON.parse(event.data);
                    console.log("📨 FirstPage收到WebSocket数据:", data);

                    // 1. 首先更新模型位置（调用 RealTimeSimulationModal 的更新函数）
                    if (updateModelsFunction) {
                        updateModelsFunction(data);
                    }

                    // 2. 然后更新实时数据显示
                    const currentTime = Date.now();
                    const newRealTimeData = {
                        model1: data.model1
                            ? {
                                  longitude: data.model1.longitude,
                                  latitude: data.model1.latitude,
                                  altitude: data.model1.altitude,
                                  yaw: data.model1.yaw,
                                  pitch: data.model1.pitch,
                                  roll: data.model1.roll,
                                  lastUpdate: currentTime,
                              }
                            : null,
                        model2: data.model2
                            ? {
                                  longitude: data.model2.longitude,
                                  latitude: data.model2.latitude,
                                  altitude: data.model2.altitude,
                                  yaw: data.model2.yaw,
                                  pitch: data.model2.pitch,
                                  roll: data.model2.roll,
                                  lastUpdate: currentTime,
                              }
                            : null,
                    };

                    setRealTimeData(newRealTimeData);
                } catch (error) {
                    console.error("❌ FirstPage解析WebSocket数据失败:", error);
                }
            };
        }

        // 设置摄像机到模型位置
        if (viewerRef.current?.cesiumElement && modelEntities.model1) {
            const position = Cesium.Matrix4.getTranslation(
                modelEntities.model1.modelMatrix,
                new Cesium.Cartesian3()
            );

            viewerRef.current.cesiumElement.camera.flyTo({
                destination: Cesium.Cartesian3.add(
                    position,
                    new Cesium.Cartesian3(0, -500, 300),
                    new Cesium.Cartesian3()
                ),
                orientation: {
                    heading: Cesium.Math.toRadians(0),
                    pitch: Cesium.Math.toRadians(-30),
                    roll: 0,
                },
            });
        }
    };

    // 修改 stopRealTimeSimulation 函数
    const stopRealTimeSimulation = () => {
        setIsRealTimeActive(false);
        setRealTimeData(null);

        // 清除WebSocket监听
        if (realTimeWebSocket) {
            realTimeWebSocket.onmessage = null;
            setRealTimeWebSocket(null);
        }

        // 移除模型
        if (viewerRef.current?.cesiumElement) {
            const cesiumViewer = viewerRef.current.cesiumElement;

            if (realTimeModels.model1) {
                cesiumViewer.scene.primitives.remove(realTimeModels.model1);
            }

            if (realTimeModels.model2) {
                cesiumViewer.scene.primitives.remove(realTimeModels.model2);
            }
        }

        setRealTimeModels({ model1: null, model2: null });
    };

    return (
        <div className="container">
            <LCPOptimizer>
                <header>
                    {/* <div style={{width:'100px'}}><img src="./public/xidian.jpg" alt="" /></div> */}
                    <h1 style={{width:'100%' ,display:"flex",justifyContent:'space-between',alignItems:'center'}}><img style={{width:'60px'}} src="./public/xidian.jpg" alt="" /><span> 飞行器可视化仿真软件</span><img style={{width:'70px'}} src="./public/gs.jpg" alt="" /></h1>
                    {/* <div style={{width:'100px'}}><img src="./public/gs.jpg" alt="" /></div> */}
                    
                                        {/* <h1>飞行器可视化仿真软件</h1> */}
                </header>
            </LCPOptimizer>

            <div
                className={`manual-adjustment-panel ${
                    showAttitudePanel ? "visible" : ""
                }`}
            >
                <h4>调整模型姿态 - {activeModel}</h4>
                <div className="adjustment-inputs">
                    <div>
                        <label>偏航角(Yaw):</label>
                        <input
                            type="number"
                            value={manualAdjustments.yaw}
                            onChange={e =>
                                handleManualAdjustment("yaw", e.target.value)
                            }
                            step="1"
                        />
                        <div className="adjustment-buttons">
                            <button onClick={() => adjustYaw(-5)}>-5°</button>
                            <button onClick={() => adjustYaw(-1)}>-1°</button>
                            <button onClick={() => adjustYaw(1)}>+1°</button>
                            <button onClick={() => adjustYaw(5)}>+5°</button>
                        </div>
                    </div>
                    <div>
                        <label>俯仰角(Pitch):</label>
                        <input
                            type="number"
                            value={manualAdjustments.pitch}
                            onChange={e =>
                                handleManualAdjustment("pitch", e.target.value)
                            }
                            step="1"
                        />
                        <div className="adjustment-buttons">
                            <button onClick={() => adjustPitch(-5)}>-5°</button>
                            <button onClick={() => adjustPitch(-1)}>-1°</button>
                            <button onClick={() => adjustPitch(1)}>+1°</button>
                            <button onClick={() => adjustPitch(5)}>+5°</button>
                        </div>
                    </div>
                    <div>
                        <label>滚转角(Roll):</label>
                        <input
                            type="number"
                            value={manualAdjustments.roll}
                            onChange={e =>
                                handleManualAdjustment("roll", e.target.value)
                            }
                            step="1"
                        />
                        <div className="adjustment-buttons">
                            <button onClick={() => adjustRoll(-5)}>-5°</button>
                            <button onClick={() => adjustRoll(-1)}>-1°</button>
                            <button onClick={() => adjustRoll(1)}>+1°</button>
                            <button onClick={() => adjustRoll(5)}>+5°</button>
                        </div>
                    </div>
                    <div className="adjustment-actions">
                        <button
                            onClick={applyManualAdjustment}
                            className="apply-button"
                        >
                            应用调整
                        </button>
                        <button
                            onClick={resetOrientation}
                            className="reset-button"
                        >
                            重置姿态
                        </button>
                        <button
                            onClick={saveModelOrientation}
                            className="save-button"
                        >
                            保存设置
                        </button>
                    </div>
                </div>
            </div>
            {showModelTypeModal && (
                <ModelTypeModal
                    onClose={() => setShowModelTypeModal(false)}
                    onSelectModelType={handleSelectModelType}
                />
            )}
            {showModelModal && (
                <ModelSelectionModal
                    onClose={() => setShowModelModal(false)}
                    onSelectLocal={handleSelectLocalModel}
                    onSelectExisting={handleSelectExistingModel}
                />
            )}
            <div className="content">
                <nav>
                    <div className="nav-div">
                        <a href="#" onClick={toggleAnimation}>
                            {isPlaying ? "停止仿真" : "开始仿真"}
                        </a>
                    </div>
                    <div className="nav-div">
                        <a href="#" onClick={() => setShowConfigModal(true)}>
                            仿真配置
                        </a>
                    </div>

                    {showConfigModal && (
                        <SimulationConfigModal
                            onClose={() => setShowConfigModal(false)}
                            onConfirm={configs => {
                                console.log("configs:", configs);
                                setSimulationConfigs(configs);

                                if (configs.length > 0) {
                                    loadConfiguration(configs);
                                }
                            }}
                        />
                    )}

                    <div className="nav-div">
                        <a
                            href="#"
                            onClick={() => {
                                if (isRealTimeActive) {
                                    stopRealTimeSimulation();
                                } else {
                                    setShowRealTimeModal(true);
                                }
                            }}
                        >
                            {isRealTimeActive ? "停止实时仿真" : "实时仿真"}
                        </a>
                    </div>
                </nav>

                <main style={{ height: "100%" }}>
                    <Viewer
                        ref={viewerRef}
                        timeline={false}
                        animation={false}
                        navigationHelpButton={false}
                        baseLayerPicker={false}
                        geocoder={false}
                        homeButton={false}
                    />
                </main>
            </div>
            <div className="tool-line">
                <button className="tool-btn" onClick={hoverModel}>
                    Model
                </button>

                <select
                    className="tool-btn"
                    value={activeModel}
                    onChange={e => selectModel(e.target.value)}
                >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <option key={`model${i}`} value={`model${i}`}>
                            模型 {i}{" "}
                            {modelFiles[`model${i}`]
                                ? `- ${modelFiles[`model${i}`]}`
                                : ""}
                        </option>
                    ))}
                </select>

                {/* <ClassComponent></ClassComponent> */}
                <select
                    className="tool-btn"
                    value={speedMultiplier}
                    onChange={e => setSpeedMultiplier(Number(e.target.value))}
                >
                    {[1, 2, 4, 8, 16, 32].map(multiplier => (
                        <option key={`speed-${multiplier}`} value={multiplier}>
                            {multiplier}X
                        </option>
                    ))}
                </select>

                <button
                    className={`tool-btn ${showAttitudePanel ? "active" : ""}`}
                    onClick={toggleAttitudePanel}
                >
                    姿态
                </button>
                <button className="tool-btn" onClick={resetOrientation}>
                    复位
                </button>
                <button
                    className={`tool-btn ${
                        showPerformanceDashboard ? "active" : ""
                    }`}
                    onClick={() =>
                        setShowPerformanceDashboard(!showPerformanceDashboard)
                    }
                    title="性能监控"
                >
                    性能
                </button>
            </div>
            <div id="dataPanel" className={isRealTimeActive ? "active" : ""}>
                {isRealTimeActive && realTimeData ? (
                    <div className="realtime-data-display">
                        <div className="panel-header">
                            <h4>实时数据监控</h4>
                            <button
                                className="stop-simulation-btn"
                                onClick={stopRealTimeSimulation}
                                title="停止实时仿真"
                            >
                                ×
                            </button>
                        </div>

                        {realTimeData.model1 && (
                            <div className="model-data">
                                <h5>模型1</h5>
                                <div className="data-row">
                                    <span>位置:</span>
                                    <div className="position-data">
                                        <span>
                                            经度:{" "}
                                            {realTimeData.model1.longitude?.toFixed(
                                                6
                                            )}
                                            °
                                        </span>
                                        <span>
                                            纬度:{" "}
                                            {realTimeData.model1.latitude?.toFixed(
                                                6
                                            )}
                                            °
                                        </span>
                                        <span>
                                            高度:{" "}
                                            {realTimeData.model1.altitude?.toFixed(
                                                2
                                            )}
                                            m
                                        </span>
                                    </div>
                                </div>
                                <div className="data-row">
                                    <span>姿态:</span>
                                    <div className="attitude-data">
                                        <span>
                                            偏航:{" "}
                                            {realTimeData.model1.yaw?.toFixed(
                                                2
                                            )}
                                            °
                                        </span>
                                        <span>
                                            俯仰:{" "}
                                            {realTimeData.model1.pitch?.toFixed(
                                                2
                                            )}
                                            °
                                        </span>
                                        <span>
                                            横滚:{" "}
                                            {realTimeData.model1.roll?.toFixed(
                                                2
                                            )}
                                            °
                                        </span>
                                    </div>
                                </div>
                                <div className="data-row">
                                    <span>
                                        更新:{" "}
                                        {realTimeData.model1.lastUpdate
                                            ? new Date(
                                                  realTimeData.model1.lastUpdate
                                              ).toLocaleTimeString()
                                            : "--"}
                                    </span>
                                </div>
                            </div>
                        )}

                        {realTimeData.model2 && (
                            <div className="model-data">
                                <h5>模型2</h5>
                                <div className="data-row">
                                    <span>位置:</span>
                                    <div className="position-data">
                                        <span>
                                            经度:{" "}
                                            {realTimeData.model2.longitude?.toFixed(
                                                6
                                            )}
                                            °
                                        </span>
                                        <span>
                                            纬度:{" "}
                                            {realTimeData.model2.latitude?.toFixed(
                                                6
                                            )}
                                            °
                                        </span>
                                        <span>
                                            高度:{" "}
                                            {realTimeData.model2.altitude?.toFixed(
                                                2
                                            )}
                                            m
                                        </span>
                                    </div>
                                </div>
                                <div className="data-row">
                                    <span>姿态:</span>
                                    <div className="attitude-data">
                                        <span>
                                            偏航:{" "}
                                            {realTimeData.model2.yaw?.toFixed(
                                                2
                                            )}
                                            °
                                        </span>
                                        <span>
                                            俯仰:{" "}
                                            {realTimeData.model2.pitch?.toFixed(
                                                2
                                            )}
                                            °
                                        </span>
                                        <span>
                                            横滚:{" "}
                                            {realTimeData.model2.roll?.toFixed(
                                                2
                                            )}
                                            °
                                        </span>
                                    </div>
                                </div>
                                <div className="data-row">
                                    <span>
                                        更新:{" "}
                                        {realTimeData.model2.lastUpdate
                                            ? new Date(
                                                  realTimeData.model2.lastUpdate
                                              ).toLocaleTimeString()
                                            : "--"}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="waiting-data">
                        {isRealTimeActive ? "等待数据..." : "实时数据显示"}
                    </div>
                )}
            </div>
            {showRealTimeModal && (
                <RealTimeSimulationModal
                    isOpen={showRealTimeModal}
                    onClose={() => setShowRealTimeModal(false)}
                    onStartSimulation={handleStartRealTimeSimulation}
                    viewerRef={viewerRef}
                />
            )}
            {showPerformanceDashboard && (
                <PerformanceDashboard
                    isVisible={showPerformanceDashboard}
                    onToggle={() =>
                        setShowPerformanceDashboard(!showPerformanceDashboard)
                    }
                />
            )}
        </div>
    );
}

export default FirstPage;
