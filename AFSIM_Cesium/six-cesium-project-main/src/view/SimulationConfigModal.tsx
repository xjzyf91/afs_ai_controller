import React, { useState } from "react";
import "./FirstPage.css";

// 新增 LocalModelsModal 组件
const LocalModelsModal = ({ onClose, onSelect, modelType }) => {
    // 模拟本地模型数据
    const localModels = [
        { id: 1, name: "B52.glb", path: "/public/localModel/B52.glb" },
        { id: 2, name: "E3.glb", path: "/public/localModel/E3.glb" },
        { id: 3, name: "f22.glb", path: "/public/localModel/f22.glb" },
        { id: 4, name: "PL12.glb", path: "/public/localModel/PL12.glb" },
    ];

    return (
        <div className="local-models-overlay">
            <div className="local-models-modal">
                <h3>选择已有模型</h3>
                <button className="close-btn" onClick={onClose}>
                    ×
                </button>
                <div className="models-grid">
                    {localModels.map(model => (
                        <div
                            key={model.id}
                            className="model-square"
                            onClick={() => {
                                onSelect(model.path, model.name);
                                onClose();
                            }}
                        >
                            <div className="model-name">{model.name}</div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const SimulationConfigModal = ({ onClose, onConfirm }) => {
    const [configs, setConfigs] = useState([
        {
            id: 1,
            targetModel: null,
            missileModel: null,
            trajectory: null,
            targetModelFile: null,
            missileModelFile: null,
            trajectoryFile: null,
        },
    ]);

    // 新增状态控制本地模型选择器的显示
    const [showLocalModels, setShowLocalModels] = useState(false);
    const [currentModelConfig, setCurrentModelConfig] = useState({
        id: null,
        type: null,
    });

    const addConfig = () => {
        setConfigs([
            ...configs,
            {
                id: Date.now(),
                targetModel: null,
                missileModel: null,
                trajectory: null,
                targetModelFile: null,
                missileModelFile: null,
                trajectoryFile: null,
            },
        ]);
    };

    const removeConfig = id => {
        if (configs.length <= 1) return;
        setConfigs(configs.filter(config => config.id !== id));
    };

    const handleFileChange = (id, type, event) => {
        const file = event.target.files[0];
        if (!file) return;

        setConfigs(
            configs.map(config => {
                if (config.id === id) {
                    return {
                        ...config,
                        [type]: URL.createObjectURL(file),
                        [`${type}File`]: file,
                    };
                }
                return config;
            })
        );
    };

    const handleLocalModelSelect = (modelPath, modelName) => {
        setConfigs(
            configs.map(config => {
                if (config.id === currentModelConfig.id) {
                    return {
                        ...config,
                        [currentModelConfig.type]: modelPath,
                        [`${currentModelConfig.type}File`]: { name: modelName },
                    };
                }
                return config;
            })
        );
    };

    const handleConfirm = () => {
        console.log("sss", configs);
        onConfirm(configs);
        onClose();
    };

    return (
        <div className="config-modal-overlay">
            <div className="config-modal">
                {/* <h2>仿真配置</h2> */}
                                    <h1 style={{width:'100%' ,display:"flex",justifyContent:'space-around',alignItems:'center'}}><div style={{width:'100px',height:'100px',padding:'20px',backgroundColor:'white'}}><img style={{width:'60px'}} src="./public/xidian.jpg" alt="" /></div><h5 style={{color:'white'}}> 仿真配置</h5><img style={{width:'100px', height:'100px'}} src="./public/gs.jpg" alt="" /></h1>
                <button className="close-btn" onClick={onClose}>
                    ×
                </button>

                <div className="config-list">
                    {configs.map(config => (
                        <div key={config.id} className="config-item">
                            <div className="model-inputs">
                                <div className="model-input">
                                    <label>目标模型</label>
                                    <div className="file-input-group">
                                        <input
                                            type="file"
                                            accept=".glb,.gltf"
                                            onChange={e =>
                                                handleFileChange(
                                                    config.id,
                                                    "targetModel",
                                                    e
                                                )
                                            }
                                            style={{ display: "none" }}
                                            id={`target-model-${config.id}`}
                                        />
                                        <label
                                            htmlFor={`target-model-${config.id}`}
                                            className="file-input-label"
                                        >
                                            {config.targetModelFile
                                                ? config.targetModelFile.name
                                                : "选择文件"}
                                        </label>
                                        <button
                                            className="local-model-btn"
                                            onClick={() => {
                                                setCurrentModelConfig({
                                                    id: config.id,
                                                    type: "targetModel",
                                                });
                                                setShowLocalModels(true);
                                            }}
                                        >
                                            已有模型
                                        </button>
                                    </div>
                                </div>
                                <div className="model-input">
                                    <label>导弹模型</label>
                                    <div className="file-input-group">
                                        <input
                                            type="file"
                                            accept=".glb,.gltf"
                                            onChange={e =>
                                                handleFileChange(
                                                    config.id,
                                                    "missileModel",
                                                    e
                                                )
                                            }
                                            style={{ display: "none" }}
                                            id={`missile-model-${config.id}`}
                                        />
                                        <label
                                            htmlFor={`missile-model-${config.id}`}
                                            className="file-input-label"
                                        >
                                            {config.missileModelFile
                                                ? config.missileModelFile.name
                                                : "选择文件"}
                                        </label>
                                        <button
                                            className="local-model-btn"
                                            onClick={() => {
                                                setCurrentModelConfig({
                                                    id: config.id,
                                                    type: "missileModel",
                                                });
                                                setShowLocalModels(true);
                                            }}
                                        >
                                            已有模型
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <div className="trajectory-input">
                                <label>轨迹文件</label>
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={e =>
                                        handleFileChange(
                                            config.id,
                                            "trajectory",
                                            e
                                        )
                                    }
                                    style={{ display: "none" }}
                                    id={`trajectory-${config.id}`}
                                />
                                <label
                                    htmlFor={`trajectory-${config.id}`}
                                    className="file-input-label"
                                >
                                    {config.trajectoryFile
                                        ? config.trajectoryFile.name
                                        : "选择文件"}
                                </label>
                            </div>
                            {configs.length > 1 && (
                                <button
                                    className="remove-btn"
                                    onClick={() => removeConfig(config.id)}
                                >
                                    删除
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <button className="add-config-btn" onClick={addConfig}>
                    继续添加配置
                </button>

                <div className="modal-actions">
                    <button className="confirm-btn" onClick={handleConfirm}>
                        确认
                    </button>
                    <button className="cancel-btn" onClick={onClose}>
                        取消
                    </button>
                </div>
            </div>

            {showLocalModels && (
                <LocalModelsModal
                    onClose={() => setShowLocalModels(false)}
                    onSelect={handleLocalModelSelect}
                    modelType={currentModelConfig.type}
                />
            )}
        </div>
    );
};

export default SimulationConfigModal;
