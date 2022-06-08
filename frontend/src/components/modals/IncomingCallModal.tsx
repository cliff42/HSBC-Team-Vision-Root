import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { newMeetingGreen } from "../../styles/Colors";
import ArrowCircleRightOutlinedIcon from "@mui/icons-material/ArrowCircleRightOutlined";
import { IncomingMeetingData } from "../../App";
import { Tooltip } from "@mui/material";

interface IncomingCallModalProps {
  open: boolean;
  onClose: () => void;
  meetingData: IncomingMeetingData;
}

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "40%",
  height: "285px",
  bgcolor: "background.paper",
  outline: "none",
  boxShadow: 24,
  p: 4,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexDirection: "column",
};

const IncomingCallModal = ({ open, onClose, meetingData }: IncomingCallModalProps) => {
  return (
    <Modal open={open} onClose={onClose} aria-labelledby="incoming-call-modal">
      <Box sx={modalStyle}>
        {meetingData.scheduled ? (
          <Typography variant="h2" component="h2" sx={{ textAlign: "center", fontSize: 50 }}>
            {meetingData.host ? "Join Your Scheduled Meeting" : "Incoming Scheduled Meeting"}
          </Typography>
        ) : (
          <Typography variant="h2" component="h2" sx={{ textAlign: "center" }}>
            {meetingData.host ? "Join Your Call" : "Incoming Call"}
          </Typography>
        )}

        <Tooltip title={meetingData.topic || ""} placement="right" arrow>
          <Typography
            variant="h5"
            component="h4"
            sx={{
              maxWidth: "90%",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: "1",
              WebkitBoxOrient: "vertical",
            }}
          >
            {meetingData.topic}
          </Typography>
        </Tooltip>

        <a href={meetingData.url} target="_blank" rel="noreferrer" onClick={onClose}>
          <ArrowCircleRightOutlinedIcon
            sx={{
              color: newMeetingGreen,
              width: "100px",
              height: "100px",
              cursor: "pointer",
            }}
          ></ArrowCircleRightOutlinedIcon>
        </a>
      </Box>
    </Modal>
  );
};

export default IncomingCallModal;
