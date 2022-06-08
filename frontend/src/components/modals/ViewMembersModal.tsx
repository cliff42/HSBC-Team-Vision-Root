import React, { useState } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import { modalColumnStyle, modalListItemStyle, modalStackStyle } from "../../styles/Style";
import { newMeetingGreen, darkNewMeetingGreen } from "../../styles/Colors";

interface ViewMembersModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  link: string;
  submitButtonText: string;
  members: string[];
}

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "25%",
  height: "70%",
  minHeight: "320px",
  minWidth: "320px",
  bgcolor: "background.paper",
  outline: "none",
  boxShadow: 24,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  p: 4,
  borderRadius: 5,
};

const ViewMembersModal = ({
  open,
  onClose,
  title,
  subtitle,
  link,
  submitButtonText,
  members,
}: ViewMembersModalProps) => {
  const [membersSearch, setMembersSearch] = useState("");

  const closeModal = () => {
    setMembersSearch("");
    onClose();
  };

  const submitModal = () => {
    closeModal();
  };

  return (
    <Modal open={open} onClose={closeModal} aria-labelledby="edit-collection-modal">
      <Box sx={modalStyle}>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>

        <Stack direction="column" spacing={2} sx={modalStackStyle}>
          <Typography>{subtitle}</Typography>
          <Paper sx={modalColumnStyle}>
            <TextField
              variant="standard"
              placeholder="Search"
              sx={{ paddingBottom: "5%", width: "80%" }}
              value={membersSearch}
              onChange={({ target }) => setMembersSearch(target.value)}
            />
            {members
              .filter((member) => member?.toLowerCase().includes(membersSearch.toLowerCase()))
              .sort()
              .map((member) => (
                <Typography variant="body1" key={member} sx={modalListItemStyle}>
                  {member}
                </Typography>
              ))}
          </Paper>
        </Stack>

        <Grid container justifyContent="flex-end">
          <Grid>
            <Button
              href={link}
              target="_blank"
              rel="noreferrer"
              variant="contained"
              sx={{
                marginTop: "12px",
                backgroundColor: newMeetingGreen,
                "&:hover": {
                  backgroundColor: darkNewMeetingGreen,
                },
              }}
              onClick={submitModal}
            >
              {submitButtonText}
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Modal>
  );
};

export default ViewMembersModal;
