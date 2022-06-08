import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setUser, clearUser } from "./reducers/userSlice";
import { setUsers } from "./reducers/usersSlice";
import { setFavourites } from "./reducers/favouritesSlice";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { RootState } from "./store";
import IncomingCallModal from "./components/modals/IncomingCallModal";
import Office from "./pages/Office";
import Groups from "./pages/Groups";
import Calendar from "./pages/Calendar";
import Layout from "./pages/Layout";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import showNotification from "./components/alerts/ScheduledMeetingNotifications";
import Admin from "./pages/Admin";
export interface IncomingMeetingData {
  topic: string;
  url: string;
  host: boolean;
  scheduled: boolean;
}

function App() {
  const [openIncomingCallModal, setopenIncomingCallModal] = useState(false);
  const [incomingMeetingData, setIncomingMeetingData] = useState<IncomingMeetingData>(
    {} as IncomingMeetingData
  );
  const [isConnected, setIsConnected] = useState(false);
  const [token, setToken] = useState("");
  const user = useSelector((state: RootState) => state.user.userToken);
  const dispatch = useDispatch();
  const auth = getAuth();

  const URL = `wss://a6hviy7i3c.execute-api.us-west-1.amazonaws.com/v1?token=${token}`;

  // Old URL for testing while real backend is down.
  // const URL = `wss://gnapzb06z7.execute-api.ca-central-1.amazonaws.com/production?token=${token}`;

  // Socket is in useRef so it doesn't change between re-renders
  const socket = useRef<WebSocket | null>(null);

  // console.log("AUTH: ", auth);
  // console.log("current user null?:", auth.currentUser == null);
  // console.log("user refresh token from state: ", user);

  const onSocketOpen = useCallback(() => {
    if (socket.current?.readyState === WebSocket.OPEN) {
      setIsConnected(true);
      socket.current?.send(JSON.stringify({ action: "getUsers" }));
      socket.current?.send(JSON.stringify({ action: "getFavourites" }));
    }
  }, []);

  const onSocketClose = useCallback(() => {
    setIsConnected(false);
  }, []);

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);

    // getUsers handler
    if (data.zoomUsers) {
      console.log(data);
      dispatch(setUsers(data.zoomUsers));
    }
    // incomingCall handler
    if (data.incomingCall) {
      console.log(data);
      setIncomingMeetingData(data.incomingCall);
      setopenIncomingCallModal(true);
    }
    // getFavourites handler
    if (data.favourites) {
      console.log(data);
      dispatch(setFavourites(data.favourites));
    }
    // handle upcoming scheduled meeting notification
    if (data.meetingAlert) {
      console.log(data);
      const notificationData = data.meetingAlert;
      switch (notificationData.type) {
        case "30Minute":
          showNotification(notificationData.topic, "Upcoming meeting in 30 minutes.");
          break;
        case "15Minute":
          showNotification(notificationData.topic, "Upcoming meeting in 15 minutes.");
          break;
      }
    }
  }, []);

  // Sets up websocket connection, closes and reopens connection when accessToken changes.
  useEffect(() => {
    console.log("connecting to websocket");
    if (token && socket.current?.readyState !== WebSocket.OPEN) {
      socket.current = new WebSocket(URL);
      socket.current?.addEventListener("open", onSocketOpen);
      socket.current?.addEventListener("close", onSocketClose);
      socket.current?.addEventListener("message", onSocketMessage, true);
      console.log("connected to websocket");
    }
    return () => {
      console.log("Closing socket");
      setIsConnected(false);
      socket.current?.removeEventListener("open", onSocketOpen);
      socket.current?.removeEventListener("close", onSocketClose);
      socket.current?.removeEventListener("message", onSocketMessage, true);
      socket.current?.close();
    };
  }, [token]);

  // Handles saving current user refresh token.
  useEffect(() => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        dispatch(setUser(user.refreshToken));
      } else {
        dispatch(clearUser());
      }
    });
  }, [auth, dispatch]);

  // Handles getting token for websocket connection
  useEffect(() => {
    auth.currentUser?.getIdToken().then((token) => {
      // console.log("Auth token: ", token);
      setToken(token);
    });
  }, [auth.currentUser]);

  return (
    <>
      {user ? (
        <Router>
          <Layout>
            <>
              <Routes>
                <Route path="/" element={<Office socket={socket} connected={isConnected} />} />
                <Route path="/groups" element={<Groups socket={socket} connected={isConnected} />} />
                <Route path="/calendar" element={<Calendar socket={socket} connected={isConnected} />} />
                <Route path="/profile" element={<Profile socket={socket} connected={isConnected} />} />
                <Route path="/admin" element={<Admin socket={socket} connected={isConnected} />} />
              </Routes>

              <IncomingCallModal
                open={openIncomingCallModal}
                onClose={() => setopenIncomingCallModal(false)}
                meetingData={incomingMeetingData}
              />
            </>
          </Layout>
        </Router>
      ) : (
        <Login />
      )}
    </>
  );
}

export default App;
