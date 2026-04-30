// 写一个普通的类组件
import React from "react";
import ReactDOM from "react-dom";
class ClassComponent extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            count: 0,
        };
    }
    componentDidMount() {
        console.log("Component mounted");
    }
    incrementCount = () => {
        ReactDOM.flushSync(() => {
            this.setState(prevState => ({
                count: prevState.count + 1,
            }));
        });
        console.log(this.state.count);

        ReactDOM.flushSync(() => {
            this.setState(prevState => ({
                count: prevState.count + 1,
            }));
        });
        console.log(this.state.count);
    };

    render() {
        return (
            <div>
                <h1>Count: {this.state.count}</h1>
                <button onClick={this.incrementCount}>Increment</button>
            </div>
        );
    }
}
export default ClassComponent;
