import { Avatar, Box, Container, Typography } from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import Header from "../components/header/Header";
import profile from "../images/profile_pic.png";
import "../styles/Styles.css";

interface ProfileProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

interface ProfileInfo {
  name: string;
  rank: string;
  email: string;
  imageUrl: string;
}

const Profile = ({ socket, connected }: ProfileProps) => {
  const [profileInfo, setProfileInfo] = useState<ProfileInfo>();

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);
    if (data.profileInfo) {
      console.log(data);
      setProfileInfo(data.profileInfo as ProfileInfo);
    }
  }, []);

  useEffect(() => {
    if (connected) {
      socket.current?.addEventListener("message", onSocketMessage, false);
      socket.current?.send(JSON.stringify({ action: "getProfileInfo" }));
    }
    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [connected]);

  const lineItem = (fieldTitle: string | null, fieldString: string | null) => {
    return (
      <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "flex-start" }}>
        <Typography sx={{ fontWeight: 400, paddingRight: "8px", letterSpacing: 1.5 }} variant="h6">
          {fieldTitle}:
        </Typography>
        <Typography sx={{ fontWeight: 900, paddingRight: "8px", letterSpacing: 1.5 }} variant="h6">
          {fieldString}
        </Typography>
      </Box>
    );
  };

  const imageOnErrorHandler = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    event.currentTarget.src = profile;
  };

  return (
    <Container maxWidth={false}>
      <Header
        title="Profile"
        socket={socket}
        connected={connected}
        showSort={false}
        showFilter={false}
        showSearchBar={false}></Header>
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          justifyContent: "flex-start",
          alignItems: "center",
          flexWrap: "wrap",
          paddingTop: "30px",
        }}>
        <Box sx={{ paddingRight: "200px" }}>
          <Avatar sx={{ height: "222px", width: "222px", border: "2px solid black" }}>
            <img
              src={profileInfo !== undefined ? profileInfo.imageUrl : profile}
              onError={imageOnErrorHandler}
              className="profilePic"></img>
          </Avatar>
        </Box>
        <Box
          sx={{ display: "flex", gap: "20px", padding: "30px", flexDirection: "column", justifyContent: "flex-start" }}>
          <Typography sx={{ paddingBottom: "10px" }} variant="h4">
            Details
          </Typography>
          {lineItem("Name", profileInfo !== undefined ? profileInfo.name : "")}
          {lineItem("Email", profileInfo !== undefined ? profileInfo.email : "")}
          {lineItem("Title", profileInfo !== undefined ? profileInfo.rank : "")}
        </Box>
      </Box>
    </Container>
  );
};

export default Profile;
