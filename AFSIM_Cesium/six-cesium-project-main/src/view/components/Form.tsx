export function Form(props) {
    const { setPosition1, setPosition2, setShowForm, position1, position2 } =
        props;
    const handleFormSubmit = event => {
        event.preventDefault();
        const formData = new FormData(event.target);
        const pos1 = {
            longitude: parseFloat(formData.get("pos1-longitude")),
            latitude: parseFloat(formData.get("pos1-latitude")),
        };
        const pos2 = {
            longitude: parseFloat(formData.get("pos2-longitude")),
            latitude: parseFloat(formData.get("pos2-latitude")),
        };
        setPosition1(pos1);
        setPosition2(pos2);
        setShowForm(false); // 关闭表单
    };

    return (
        <div className="form-overlay">
            <div className="form-container">
                <h2>配置飞行器参数</h2>
                <form onSubmit={handleFormSubmit}>
                    <div className="form-group">
                        <label>Position 1 (经度, 纬度)</label>
                        <input
                            type="number"
                            name="pos1-longitude"
                            placeholder="经度"
                            defaultValue={position1.longitude}
                            step="0.01"
                            required
                        />
                        <input
                            type="number"
                            name="pos1-latitude"
                            placeholder="纬度"
                            defaultValue={position1.latitude}
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Position 2 (经度, 纬度)</label>
                        <input
                            type="number"
                            name="pos2-longitude"
                            placeholder="经度"
                            defaultValue={position2.longitude}
                            step="0.01"
                            required
                        />
                        <input
                            type="number"
                            name="pos2-latitude"
                            placeholder="纬度"
                            defaultValue={position2.latitude}
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>高度</label>
                        <input
                            type="number"
                            name="pos2-longitude"
                            placeholder="高度"
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>速度</label>
                        <input
                            type="number"
                            name="pos2-longitude"
                            placeholder="速度"
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="form-buttons">
                        <button
                            type="button"
                            onClick={() => setShowForm(false)}
                        >
                            取消
                        </button>
                        <button type="submit">保存</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
