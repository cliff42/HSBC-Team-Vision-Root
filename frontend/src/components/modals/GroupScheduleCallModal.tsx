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
import AdapterDateFns from "@mui/lab/AdapterDateFns";
import LocalizationProvider from "@mui/lab/LocalizationProvider";
import DateTimePicker from "@mui/lab/DateTimePicker";
import { Checkbox, FormControlLabel, IconButton, Tooltip } from "@mui/material";
import { newMeetingGreen, darkNewMeetingGreen } from "../../styles/Colors";
import Notification from "../alerts/Notification";
import { setNotification, clearNotification } from "../../reducers/notificationSlice";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

interface GroupScheduleCallModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  subtitle1: string;
  subtitle2: string;
  submitHandler: (
    employees: User[],
    name: string,
    startDate: Date,
    endDate: Date,
    waitingRoom: boolean
  ) => void;
  submitButtonText: string;
  existingCollection: User[];
  nameLabelText: string;
}

// Custom style for this modal
const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "60%",
  height: "80%",
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

const employeeColumnStyle = {
  padding: "4.5%",
  textAlign: "left",
  width: "90%",
  height: "100%",
  borderRadius: 5,
  border: "1px solid black",
  overflow: "auto",
};

const employeeStyle = {
  paddingLeft: "5px",
  paddingRight: "5px",
  borderRadius: 1,
  "&:hover": {
    backgroundColor: "lightgrey",
  },
};

const GroupScheduleCallModal = ({
  open,
  onClose,
  title,
  subtitle1,
  subtitle2,
  submitHandler,
  submitButtonText,
  existingCollection,
  nameLabelText,
}: GroupScheduleCallModalProps) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [addedEmployees, setAddedEmployees] = useState<User[]>([]);
  const [employeesSearch, setEmployeesSearch] = useState("");
  const [addedEmployeesSearch, setAddedEmployeesSearch] = useState("");
  const [nameField, setNameField] = useState("");
  const [startDate, setStartDate] = useState(new Date() || null);
  const [endDate, setEndDate] = useState(new Date() || null);
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
    setStartDate(new Date());
    setEndDate(new Date());
    setWaitingRoom(false);
    setAddedEmployees(existingCollection);
    setEmployees([]);
    dispatch(clearNotification());
    onClose();
  };

  const submitModal = () => {
    const fiveMinutesInFuture = new Date(new Date().getTime() + 5 * 60000).getTime();
    if (nameField.length === 0) {
      dispatch(setNotification("Must provide a meeting name."));
      return;
    } else if (addedEmployees.length === 0) {
      dispatch(setNotification("No employees added to the call."));
      return;
    } else if (startDate.getTime() < fiveMinutesInFuture) {
      dispatch(setNotification("Cannot schedule a meeting within 5 minutes of the current time."));
      return;
    } else if (endDate.getTime() < startDate.getTime()) {
      dispatch(setNotification("Meeting end time must be after start time."));
      return;
    }

    submitHandler([...addedEmployees], nameField, startDate, endDate, waitingRoom);
    closeModal();
  };

  return (
    <Modal open={open} onClose={closeModal} aria-labelledby="edit-collection-modal">
      <Box sx={modalStyle}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>

        <Stack
          direction="row"
          spacing={2}
          sx={{
            width: "100%",
            maxHeight: "68%",
            marginTop: "10px",
            flexGrow: 4,
            paddingBottom: "10px",
          }}
        >
          <Stack direction="column" spacing={2} sx={{ width: "50%" }}>
            <Typography>{subtitle1}</Typography>
            <Paper sx={employeeColumnStyle}>
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
                    sx={employeeStyle}
                  >
                    {employee.name}
                  </Typography>
                ))}
            </Paper>
          </Stack>

          <Stack direction="column" spacing={2} sx={{ width: "50%" }}>
            <Typography>{subtitle2}</Typography>
            <Paper sx={employeeColumnStyle}>
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
                    sx={employeeStyle}
                  >
                    {employee.name}
                  </Typography>
                ))}
            </Paper>
          </Stack>
        </Stack>

        <Notification type="error" />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
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

          <Grid
            container
            justifyContent="flex-end"
            alignItems="flex-end"
            columns={4}
            sx={{ paddingTop: "15px" }}
          >
            <Stack spacing={2}>
              <Grid sx={{ paddingRight: "15px" }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    renderInput={(params) => <TextField {...params} />}
                    label="Pick start date and time"
                    value={startDate}
                    onChange={(newDate) => {
                      newDate && setStartDate(newDate);
                    }}
                    minDateTime={new Date()}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DateTimePicker
                    renderInput={(params) => <TextField {...params} />}
                    label="Pick end date and time"
                    value={endDate}
                    onChange={(newDate) => {
                      newDate && setEndDate(newDate);
                    }}
                    minDateTime={startDate}
                  />
                </LocalizationProvider>
              </Grid>
            </Stack>

            <Grid sx={{ paddingRight: "15px" }}>
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
            <Grid sx={{ paddingRight: "15px" }}>
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

export default GroupScheduleCallModal;
