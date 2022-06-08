import React, { useState } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import AddEmployeeModal from "../modals/AddEmployeeModal";
import { User } from "../../reducers/usersSlice";
import { newMeetingGreen } from "../../styles/Colors";
import { sizes } from "../../styles/Style";

interface NewGroupCardProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

interface NewGroupData {
  action: string;
  title: string;
  members: Array<string>;
}

const NewGroupCard = ({ socket, connected }: NewGroupCardProps) => {
  const [open, setOpen] = useState(false);
  const handleOpen = () => setOpen(true);
  const handleClose = () => setOpen(false);

  const createGroup = (employees: User[], title: string, _unused : boolean) => {
    if (employees.length == 0 || title.length == 0) {
      console.log("No employees added to group, or no title added");
      return;
    }

    if (connected) {
      console.log("Creating a group with members: ", employees);
      const dataToSend: NewGroupData = {
        action: "createGroup",
        title: title,
        members: employees.map((employee) => employee.UserID),
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
          New Group
        </Typography>
        <AddIcon sx={{ color: newMeetingGreen, width: "25%", height: "25%" }} />
      </Paper>
      <AddEmployeeModal
        open={open}
        onClose={handleClose}
        title="Create New Group"
        subtitle1="All Employees"
        subtitle2="Employees in the Group"
        submitHandler={createGroup}
        submitButtonText="Create Group"
        nameLabelText="Group Name"
        socket={socket}
        connected={connected}
        isMeeting={false}
      />
    </>
  );
};

export default NewGroupCard;
