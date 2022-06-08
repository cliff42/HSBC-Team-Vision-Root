import React, { useState } from "react";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography/Typography";
import ArrowCircleRightOutlinedIcon from "@mui/icons-material/ArrowCircleRightOutlined";
import { newMeetingGreen, meetingCardRoseCream, alertYellow } from "../../styles/Colors";
import GroupIcon from "@mui/icons-material/Group";
import { ButtonGroup, IconButton, Tooltip } from "@mui/material";
import { sizes } from "../../styles/Style";
import ViewMembersModal from "../modals/ViewMembersModal";

interface CallCardProps {
  title: string;
  members: Array<string>;
  link: string;
}

export default function CallCard({ title, members, link }: CallCardProps) {
  const [openMembers, setOpenMembers] = useState(false);

  const closeMembersModal = () => {
    setOpenMembers(false);
  };

  return (
    <Paper
      sx={{
        padding: 2,
        textAlign: "center",
        // backgroundColor: meetingCardRoseCream,
        // Best two
        // backgroundColor: "#f5f2f2",
        backgroundColor: "#f7f6f5",
        borderRadius: 15,
        height: sizes.tileSize,
        width: sizes.tileSize,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexDirection: "column",
      }}
    >
      <Tooltip title={title} placement="top" arrow>
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
          {title}
        </Typography>
      </Tooltip>

      <a href={link} target="_blank" rel="noreferrer">
        <ArrowCircleRightOutlinedIcon
          sx={{
            color: newMeetingGreen,
            width: sizes.enterCallButtonSize,
            height: sizes.enterCallButtonSize,
            cursor: "pointer",
          }}
        />
      </a>
      <ButtonGroup>
        <IconButton onClick={() => setOpenMembers(true)}>
          <GroupIcon
            sx={{ color: alertYellow, width: sizes.membersButtonSize, height: sizes.membersButtonSize }}
          />
        </IconButton>
      </ButtonGroup>
      <ViewMembersModal
        open={openMembers}
        onClose={closeMembersModal}
        title={title}
        subtitle={`Current Members (${members.length})`}
        link={link}
        submitButtonText="Join Meeting"
        members={members}
      />
    </Paper>
  );
}
