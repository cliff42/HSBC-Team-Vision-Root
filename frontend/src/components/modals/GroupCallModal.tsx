import React, { useState, useEffect } from "react";
import { useDispatch } from "react-redux";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import { User } from "../../reducers/usersSlice";
import { modalStyle, modalColumnStyle, modalListItemStyle, modalStackStyle } from "../../styles/Style";
import { newMeetingGreen, darkNewMeetingGreen } from "../../styles/Colors";
import { Checkbox, FormControlLabel, IconButton, Tooltip } from "@mui/material";
import Notification from "../alerts/Notification";
import { setNotification, clearNotification } from "../../reducers/notificationSlice";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

interface GroupCallModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  subtitle1: string;
  subtitle2: string;
  submitHandler: (employees: User[], name: string, waitingRoom: boolean) => void;
  submitButtonText: string;
  existingCollection: User[];
  nameLabelText: string;
}

const GroupCallModal = ({
  open,
  onClose,
  title,
  subtitle1,
  subtitle2,
  submitHandler,
  submitButtonText,
  existingCollection,
  nameLabelText,
}: GroupCallModalProps) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [addedEmployees, setAddedEmployees] = useState<User[]>([]);
  const [employeesSearch, setEmployeesSearch] = useState("");
  const [addedEmployeesSearch, setAddedEmployeesSearch] = useState("");
  const [nameField, setNameField] = useState("");
  const [waitingRoom, setWaitingRoom] = useState(false);
  const dispatch = useDispatch();

  useEffect(() => {
    setAddedEmployees(existingCollection);
  }, [existingCollection]);

  const addToCollection = (employee: User) => {
    setAddedEmployees([...addedEmployees, employee]);
    setEmployees(employees.filter((e) => e.UserID !== employee.UserID));
  };

  const removeFromCollection = (employee: User) => {
    setAddedEmployees(addedEmployees.filter((e) => e.UserID !== employee.UserID));
    setEmployees([...employees, employee]);
  };

  const sortNames = (a: User, b: User): number => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  };

  const closeModal = () => {
    setEmployeesSearch("");
    setAddedEmployeesSearch("");
    setNameField("");
    setWaitingRoom(false);
    setAddedEmployees(existingCollection);
    setEmployees([]);
    dispatch(clearNotification());
    onClose();
  };

  const submitModal = () => {
    if (nameField.length === 0) {
      dispatch(setNotification("Must provide a meeting name."));
      return;
    } else if (addedEmployees.length === 0) {
      dispatch(setNotification("No employees added to the call."));
      return;
    }

    submitHandler([...addedEmployees], nameField, waitingRoom);
    closeModal();
  };

  return (
    <Modal open={open} onClose={closeModal} aria-labelledby="edit-collection-modal">
      <Box sx={modalStyle}>
        <Typography variant="h5" component="h2">
          {title}
        </Typography>

        <Stack direction="row" spacing={2} sx={modalStackStyle}>
          <Stack direction="column" spacing={2} sx={{ width: "50%" }}>
            <Typography>{subtitle1}</Typography>
            <Paper sx={modalColumnStyle}>
              <TextField
                variant="standard"
                placeholder="Search"
                sx={{ paddingBottom: "5%", width: "80%" }}
                value={employeesSearch}
                onChange={({ target }) => setEmployeesSearch(target.value)}
              />
              {employees
                .filter((e) => e.name?.toLowerCase().includes(employeesSearch.toLowerCase()))
                .sort(sortNames)
                .map((employee) => (
                  <Typography
                    variant="body1"
                    key={employee.UserID}
                    onClick={() => addToCollection(employee)}
                    sx={modalListItemStyle}
                  >
                    {employee.name}
                  </Typography>
                ))}
            </Paper>
          </Stack>

          <Stack direction="column" spacing={2} sx={{ width: "50%" }}>
            <Typography>{subtitle2}</Typography>
            <Paper sx={modalColumnStyle}>
              <TextField
                variant="standard"
                placeholder="Search"
                sx={{ paddingBottom: "5%", width: "80%" }}
                value={addedEmployeesSearch}
                onChange={({ target }) => setAddedEmployeesSearch(target.value)}
              />
              {addedEmployees
                .filter((e) => e.name?.toLowerCase().includes(addedEmployeesSearch.toLowerCase()))
                .sort(sortNames)
                .map((employee) => (
                  <Typography
                    variant="body1"
                    key={employee.UserID}
                    onClick={() => removeFromCollection(employee)}
                    sx={modalListItemStyle}
                  >
                    {employee.name}
                  </Typography>
                ))}
            </Paper>
          </Stack>
        </Stack>

        <Notification type="error" />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tooltip
            disableFocusListener
            disableTouchListener
            placement="right"
            title="Click on an employee on the right to remove them from the call. Click on an employee on the left to add them back. "
          >
            <IconButton sx={{ marginTop: "12px" }}>
              <QuestionMarkIcon sx={{ color: "grey" }} />
            </IconButton>
          </Tooltip>

          <Grid container justifyContent="flex-end" columns={3}>
            <Grid sx={{ paddingRight: "15px", paddingTop: "12px" }}>
              <FormControlLabel
                value={waitingRoom}
                onChange={() => {
                  setWaitingRoom(!waitingRoom);
                }}
                control={<Checkbox />}
                label="Use Waiting Room"
                labelPlacement="start"
              />
            </Grid>
            <Grid sx={{ paddingRight: "15px", paddingTop: "16px" }}>
              <TextField
                id="standard-basic"
                placeholder={nameLabelText}
                value={nameField}
                variant="standard"
                onChange={({ target }) => setNameField(target.value)}
              />
            </Grid>
            <Grid>
              <Button
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
      </Box>
    </Modal>
  );
};

export default GroupCallModal;
