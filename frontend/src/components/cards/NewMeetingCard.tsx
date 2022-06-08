import React, { useState } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AddEmployeeModal from "../modals/AddEmployeeModal";
import { User } from "../../reducers/usersSlice";
import { newMeetingGreen } from "../../styles/Colors";
import { sizes } from "../../styles/Style";

interface NewMeetingCardProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

export interface NewMeetingData {
  action: string;
  body: {
    topic: string;
    members: string[];
    waitingRoom: boolean;
  };
}

const NewMeetingCard = ({ socket, connected }: NewMeetingCardProps) => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const callEmployees = (employees: User[], name: string, waitingRoom: boolean) => {
    if (employees.length == 0 || name.length == 0) {
      console.log("No employees added to call, or no title added");
      return;
    }

    if (connected) {
      console.log("calling", employees);
      const dataToSend: NewMeetingData = {
        action: "createMeeting",
        body: {
          topic: name,
          members: employees.map((employee) => employee.UserID),
          waitingRoom: waitingRoom,
        },
      };

      console.log(JSON.stringify(dataToSend));
      socket.current?.send(JSON.stringify(dataToSend));
    }
  };

  return (
    <>
      <Paper
        sx={{
          padding: 2,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          flexDirection: "column",
          borderRadius: 15,
          border: `2px solid ${newMeetingGreen}`,
          cursor: "pointer",
          height: sizes.tileSize,
          width: sizes.tileSize,
        }}
        onClick={handleOpen}
      >
        <Typography variant="h5" sx={{ color: newMeetingGreen, fontWeight: "bold" }}>
          New Meeting
        </Typography>
        <AddIcon sx={{ color: newMeetingGreen, width: "25%", height: "25%" }} />
      </Paper>
      <AddEmployeeModal
        open={open}
        onClose={handleClose}
        title="Add Employees"
        subtitle1="All Employees"
        subtitle2="Employees in the Call"
        submitHandler={callEmployees}
        submitButtonText="Call Now"
        nameLabelText="Meeting Name"
        socket={socket}
        connected={connected}
        isMeeting={true}
      />
    </>
  );
};

export default NewMeetingCard;
