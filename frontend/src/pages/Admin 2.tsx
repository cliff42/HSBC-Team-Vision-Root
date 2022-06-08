import {
  Button,
  Container,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useState } from "react";
import { newMeetingGreen, darkNewMeetingGreen } from "../styles/Colors";
import Notification from "../components/alerts/Notification";
import { setNotification } from "../reducers/notificationSlice";
import { useDispatch } from "react-redux";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

interface AdminProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

const Admin = ({ socket, connected }: AdminProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState("1");
  const dispatch = useDispatch();

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);

    // Listen for successful new user response
    if (data === "addedUser") {
      console.log(data);
      dispatch(setNotification("Successfully created new user."));
      socket.current?.send(JSON.stringify({ action: "getUsers" }));
    }
  }, []);

  useEffect(() => {
    if (connected) {
      socket.current?.addEventListener("message", onSocketMessage, false);
    }
    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [connected]);

  const createNewUser = () => {
    if (connected) {
      if (name.length == 0 || email.length == 0) {
        console.log("Cannot add employee without a name or email.");
        return;
      }

      const dataToSend = {
        action: "addUser",
        body: { email: email, name: name, rank: rank },
      };

      console.log(JSON.stringify(dataToSend));
      socket.current?.send(JSON.stringify(dataToSend));

      setName("");
      setEmail("");
      setRank("1");
    }
  };

  return (
    <Container>
      <Typography variant="h2" sx={{ paddingBottom: "50px" }}>
        Admin
      </Typography>

      <Typography variant="h4" sx={{ paddingBottom: "10px" }}>
        Add User
      </Typography>
      <TextField
        placeholder={"Name"}
        value={name}
        variant="standard"
        onChange={({ target }) => setName(target.value)}
        sx={{ paddingBottom: "10px" }}
      />
      <br />
      <TextField
        placeholder={"Email"}
        value={email}
        variant="standard"
        onChange={({ target }) => setEmail(target.value)}
        sx={{ paddingBottom: "20px" }}
      />
      <br />
      <FormControl sx={{ paddingBottom: "20px" }}>
        <InputLabel id="rank-label">Rank</InputLabel>
        <Select
          labelId="rank-label"
          value={rank}
          label="Rank"
          onChange={({ target }) => setRank(target.value)}
        >
          <MenuItem value={"5"}>CEO</MenuItem>
          <MenuItem value={"4"}>Vice President</MenuItem>
          <MenuItem value={"3"}>Project Manager</MenuItem>
          <MenuItem value={"2"}>Software Engineer</MenuItem>
          <MenuItem value={"1"}>Junior Sales Associate</MenuItem>
        </Select>
      </FormControl>
      <br />
      <Button
        variant="contained"
        sx={{
          marginBottom: "20px",
          backgroundColor: newMeetingGreen,
          "&:hover": {
            backgroundColor: darkNewMeetingGreen,
          },
        }}
        onClick={createNewUser}
      >
        Create New User
      </Button>

      <Notification type="success" />

      <Tooltip
        disableFocusListener
        disableTouchListener
        placement="right"
        title="Users added must be attached to valid Zoom accounts which belong to the company Zoom organization."
      >
        <IconButton sx={{ position: "fixed", bottom: 10, left: 310 }}>
          <QuestionMarkIcon sx={{ color: "grey" }} />
        </IconButton>
      </Tooltip>
    </Container>
  );
};

export default Admin;
