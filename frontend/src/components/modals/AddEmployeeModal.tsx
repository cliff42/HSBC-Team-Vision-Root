/* eslint-disable indent */
import React, { useState, useEffect, useCallback } from "react";
import { useDispatch } from "react-redux";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { User } from "../../reducers/usersSlice";
import { getAuth } from "firebase/auth";
import { modalStyle, modalColumnStyle, modalListItemStyle, modalStackStyle } from "../../styles/Style";
import { newMeetingGreen, darkNewMeetingGreen, mainRed } from "../../styles/Colors";
import { LocationData, IncomingLocationData, GetLocationData } from "./EditCollectionModal";
import CircleIcon from "@mui/icons-material/Circle";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";
import { Checkbox, FormControlLabel, IconButton, Tooltip } from "@mui/material";
import Notification from "../alerts/Notification";
import { setNotification, clearNotification } from "../../reducers/notificationSlice";

interface AddEmployeeModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle1: string;
  subtitle2: string;
  submitHandler: (employees: User[], name: string, waitingRoom: boolean) => void;
  submitButtonText: string;
  nameLabelText: string;
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
  isMeeting: boolean;
}

const AddEmployeeModal = ({
  open,
  onClose,
  title,
  subtitle1,
  subtitle2,
  submitHandler,
  submitButtonText,
  nameLabelText,
  socket,
  connected,
  isMeeting,
}: AddEmployeeModalProps) => {
  const users = useSelector((state: RootState) => state.users.usersList);
  const [employees, setEmployees] = useState<User[]>([]);
  const [addedEmployees, setAddedEmployees] = useState<User[]>([]);
  const [employeesSearch, setEmployeesSearch] = useState("");
  const [addedEmployeesSearch, setAddedEmployeesSearch] = useState("");
  const [nameField, setNameField] = useState("");
  const [userLocations, setUserLocations] = useState<LocationData>({});
  const [waitingRoom, setWaitingRoom] = useState<boolean>(false);
  const dispatch = useDispatch();
  const auth = getAuth();

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);

    if (data.userLocations) {
      console.log(data);
      const locations = data.userLocations.reduce(
        (o: LocationData, user: IncomingLocationData) => ({ ...o, [user.UserId]: user.location }),
        {} as LocationData
      );
      setUserLocations(locations);
    }
  }, []);

  useEffect(() => {
    setEmployees(users.filter((e) => auth.currentUser?.uid !== e.UserID));

    if (connected && open && isMeeting) {
      socket.current?.addEventListener("message", onSocketMessage, false);

      const dataToSend: GetLocationData = {
        action: "getUserLocations",
        body: {
          users: users.map((employee) => employee.UserID),
        },
      };
      socket.current?.send(JSON.stringify(dataToSend));
    }

    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [users, connected, open]);

  const addToCall = (employee: User) => {
    if (isMeeting && userLocations[employee.UserID]) return;

    setAddedEmployees([...addedEmployees, employee]);
    setEmployees(employees.filter((e) => e.UserID !== employee.UserID));
  };

  const removeFromCall = (employee: User) => {
    setAddedEmployees(addedEmployees.filter((e) => e.UserID !== employee.UserID));
    setEmployees([...employees, employee]);
  };

  const sortNames = (a: User, b: User): number => {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  };

  const closeModal = () => {
    setAddedEmployees([]);
    setEmployees(users.filter((e) => auth.currentUser?.uid !== e.UserID));
    setEmployeesSearch("");
    setAddedEmployeesSearch("");
    setNameField("");
    dispatch(clearNotification());
    onClose();
  };

  const submitModal = () => {
    if (nameField.length === 0) {
      if (isMeeting) dispatch(setNotification("Must provide a meeting name."));
      else dispatch(setNotification("Must provide a group name."));

      return;
    } else if (addedEmployees.length === 0) {
      if (isMeeting) dispatch(setNotification("No employees added to the call."));
      else dispatch(setNotification("No employees added to the group."));

      return;
    }
    submitHandler([...addedEmployees], nameField, waitingRoom);
    closeModal();
  };

  const helpString = isMeeting
    ? "Click on an employee on the left to add them to the call. Click on an employee on the right to remove them from the call."
    : "Click on an employee on the left to add them to the group. Click on an employee on the right to remove them from the group.";

  return (
    <Modal open={open} onClose={closeModal} aria-labelledby="new-meeting-modal">
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
                  <Box
                    key={employee.UserID}
                    onClick={() => addToCall(employee)}
                    sx={{ ...modalListItemStyle, display: "flex", alignItems: "center" }}
                  >
                    {isMeeting ? (
                      !userLocations[employee.UserID] || userLocations[employee.UserID].length === 0 ? (
                        <CircleIcon
                          sx={{
                            height: "15px",
                            width: "15px",
                            paddingRight: "4.5px",
                            color: newMeetingGreen,
                          }}
                        />
                      ) : (
                        <CircleIcon
                          sx={{ height: "15px", width: "15px", paddingRight: "4.5px", color: mainRed }}
                        />
                      )
                    ) : null}

                    <Typography variant="body1">{employee.name}</Typography>
                  </Box>
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
                  <Box
                    key={employee.UserID}
                    onClick={() => removeFromCall(employee)}
                    sx={{ ...modalListItemStyle, display: "flex", alignItems: "center" }}
                  >
                    {isMeeting ? (
                      !userLocations[employee.UserID] || userLocations[employee.UserID].length === 0 ? (
                        <CircleIcon
                          sx={{
                            height: "15px",
                            width: "15px",
                            paddingRight: "4.5px",
                            color: newMeetingGreen,
                          }}
                        />
                      ) : (
                        <CircleIcon
                          sx={{ height: "15px", width: "15px", paddingRight: "4.5px", color: mainRed }}
                        />
                      )
                    ) : null}

                    <Typography variant="body1">{employee.name}</Typography>
                  </Box>
                ))}
            </Paper>
          </Stack>
        </Stack>

        <Notification type="error" />

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tooltip disableFocusListener disableTouchListener placement="right" title={helpString}>
            <IconButton sx={{ marginTop: "12px" }}>
              <QuestionMarkIcon sx={{ color: "grey" }} />
            </IconButton>
          </Tooltip>

          <Grid container justifyContent="flex-end">
            {isMeeting && (
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
            )}
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

export default AddEmployeeModal;
