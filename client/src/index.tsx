import React from 'react';
import ReactDOM from 'react-dom';
import {BrowserRouter, Route, Switch} from 'react-router-dom';
import './index.css';
import Home from './Home';
import reportWebVitals from './reportWebVitals';
import CreateRoom from './CreateRoom';
import Room from './Room';

ReactDOM.render(
    <React.StrictMode>
        <BrowserRouter>
            <Switch>
                <Route path="/" exact={true}>
                    <Home />
                </Route>
                <Route path="/create-room">
                    <CreateRoom />
                </Route>
                <Route path="/room/:room" component={Room}></Route>
            </Switch>
        </BrowserRouter>
    </React.StrictMode>,
    document.getElementById('root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
