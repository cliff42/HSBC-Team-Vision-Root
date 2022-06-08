import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import React, { useState } from "react";
import {
  meetingCardRoseCream,
  garbageRed,
  mainRed,
  alertYellow,
  newMeetingGreen,
  calendarBlue,
} from "../../styles/Colors";
import { GroupInfo } from "../../pages/Groups";
import { ButtonGroup, IconButton, Stack, Tooltip } from "@mui/material";
import CallIcon from "@mui/icons-material/Call";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { User } from "../../reducers/usersSlice";
import EditCollectionModal from "../modals/EditCollectionModal";
import { sizes } from "../../styles/Style";
import GroupCallModal from "../modals/GroupCallModal";
import EmployeeAvatar from "../icons/EmployeeAvatar";
import OverflowAvatar from "../icons/OverflowAvatar";
import GroupScheduleCallModal from "../modals/GroupScheduleCallModal";
import { start } from "repl";

interface GroupCardProps {
  group: GroupInfo;
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

interface NewCallData {
  action: string;
  body: {
    topic: string;
    members: string[];
    waitingRoom: boolean;
  };
}

interface DeleteGroupData {
  action: string;
  GroupID: string;
}

interface EditGroupData {
  action: string;
  GroupID: string;
  members: string[];
}

interface ScheduleCallData {
  action: string;
  body: {
    topic: string;
    startTime: string;
    endTime: string;
    members: string[];
    waitingRoom: boolean;
  };
}

export default function GroupCard({ group, socket, connected }: GroupCardProps) {
  const [openGroupEdit, setOpenGroupEdit] = useState(false);
  const [openGroupCall, setOpenGroupCall] = useState(false);
  const [openGroupScheduleCall, setOpenGroupScheduleCall] = useState(false);

  const handleCall = (users: User[]) => {
    if (!connected) return;
    setOpenGroupCall(true);
  };

  const handleCallClose = () => {
    setOpenGroupCall(false);
  };

  const handleSchedule = () => {
    setOpenGroupScheduleCall(true);
  };

  const handleScheduleClose = () => {
    setOpenGroupScheduleCall(false);
  };

  const handleEdit = () => {
    console.log("editing ", group.title);
    setOpenGroupEdit(true);
  };

  const handleDelete = () => {
    if (!connected) return;

    console.log("deleting group:", group.title);

    const dataToSend: DeleteGroupData = {
      action: "deleteGroup",
      GroupID: group.GroupID,
    };

    console.log(JSON.stringify(dataToSend));
    socket.current?.send(JSON.stringify(dataToSend));
  };

  const editGroup = (users: User[]) => {
    setOpenGroupEdit(false);
    // check if there are new users, if no new users, don't update group
    if (!connected || users == group.members || users.length === 0) return;

    const dataToSend: EditGroupData = {
      action: "editGroup",
      GroupID: group.GroupID,
      members: users.map((employee) => employee.UserID),
    };
    console.log(JSON.stringify(dataToSend));
    socket.current?.send(JSON.stringify(dataToSend));
  };

  const groupCall = (users: User[], title: string, waitingRoom: boolean) => {
    if (users.length == 0 || title.length == 0) {
      console.log("No employees added to call, or no title added");
      return;
    }

    const dataToSend: NewCallData = {
      action: "createMeeting",
      body: {
        topic: title,
        members: users.map((employee) => employee.UserID),
        waitingRoom: waitingRoom,
      },
    };

    console.log(JSON.stringify(dataToSend));
    socket.current?.send(JSON.stringify(dataToSend));
  };

  const scheduleCall = (
    users: User[],
    title: string,
    startDate: Date,
    endDate: Date,
    waitingRoom: boolean
  ) => {
    if (users.length == 0 || title.length == 0) {
      console.log("No employees added to call, or no title added");
      return;
    }

    startDate.setUTCSeconds(0);
    endDate.setUTCSeconds(0);
    const dataToSend: ScheduleCallData = {
      action: "createScheduledMeeting",
      body: {
        topic: title,
        startTime: startDate.toISOString().split(".")[0] + "Z",
        endTime: endDate.toISOString().split(".")[0] + "Z",
        members: users.map((employee) => employee.UserID),
        waitingRoom: waitingRoom,
      },
    };

    console.log(JSON.stringify(dataToSend));
    socket.current?.send(JSON.stringify(dataToSend));
  };

  return (
    <Paper
      sx={{
        padding: 2,
        textAlign: "center",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: "column",
        // backgroundColor: meetingCardRoseCream,
        // Best two
        // backgroundColor: "#f5f2f2",
        backgroundColor: "#f7f6f5",

        // Other options
        // backgroundColor: "#DDECEF",
        // backgroundColor: "#F6F6F6",
        // backgroundColor: "#f7f2f2",
        // backgroundColor: "#ebeff0",
        borderRadius: 15,
        height: sizes.tileSize,
        width: sizes.tileSize,
      }}
    >
      <Tooltip title={group.title} placement="top" arrow>
        <Typography
          variant="h6"
          sx={{
            fontWeight: "bold",
            maxHeight: "60px",
            height: "60px",
            maxWidth: "90%",
            paddingTop: "10px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: "2",
            WebkitBoxOrient: "vertical",
          }}
        >
          {group.title}
        </Typography>
      </Tooltip>
      <Stack direction="row" spacing={1}>
        {group.members
          .filter((item, idx) => idx < 3)
          .map((member: User) => (
            <EmployeeAvatar key={member.UserID} name={member.name}></EmployeeAvatar>
          ))}
        {group.members.length > 3 ? <OverflowAvatar size={group.members.length - 3}></OverflowAvatar> : null}
      </Stack>
      <ButtonGroup>
        <IconButton onClick={() => handleCall(group.members)}>
          <CallIcon sx={{ color: newMeetingGreen, fontSize: sizes.groupsButtonSize }} />
        </IconButton>
        <IconButton onClick={handleSchedule}>
          <CalendarMonthIcon sx={{ color: calendarBlue, fontSize: sizes.groupsButtonSize }} />
        </IconButton>
        <IconButton onClick={handleEdit}>
          <EditIcon sx={{ color: alertYellow, fontSize: sizes.groupsButtonSize }} />
        </IconButton>
        <IconButton onClick={handleDelete}>
          <DeleteIcon sx={{ color: garbageRed, fontSize: sizes.groupsButtonSize }} />
        </IconButton>
      </ButtonGroup>
      <GroupCallModal
        open={openGroupCall}
        title={"Select members to call"}
        onClose={handleCallClose}
        subtitle1={"Not in call"}
        subtitle2={"In call"}
        submitHandler={groupCall}
        submitButtonText="Call Group"
        existingCollection={group.members}
        nameLabelText="Meeting Name"
      />
      <EditCollectionModal
        open={openGroupEdit}
        onClose={editGroup}
        title={group.title}
        subtitle1="All Employees"
        subtitle2="Current Members"
        submitHandler={handleCall}
        submitButtonText="Close"
        existingCollection={group.members}
        isGroup={true}
        socket={socket}
        connected={connected}
      />
      <GroupScheduleCallModal
        open={openGroupScheduleCall}
        onClose={handleScheduleClose}
        title={"Schedule Group Call"}
        subtitle1={"Not in call"}
        subtitle2={"In call"}
        submitHandler={scheduleCall}
        submitButtonText={"Schedule Call"}
        existingCollection={group.members}
        nameLabelText="Meeting name"
      />
    </Paper>
  );
}
