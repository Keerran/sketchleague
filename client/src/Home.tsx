import React, {Component} from 'react';
import './util';
import './App.css';
import {Link} from 'react-router-dom';

class Home extends Component<{}, { rooms: string[] }> {
    constructor(props: {}) {
        super(props);
        this.state = {rooms: []}
    }


    componentDidMount() {
        window.fetchBackend("/rooms").then(json => {
            console.log(json)
            this.setState({
                rooms: json
            })
        })
    }

    render = () => (
        <div className="App">
            <Link to="/create-room">
                <button>Create Room</button>
            </Link>

            <ul id="rooms">
                {this.state.rooms.map(room => {
                    return <li key={room} className="room"><a href={ `/room/${room}` }>{room}</a></li>
                })}
            </ul>
        </div>
    );
}

export default Home;
