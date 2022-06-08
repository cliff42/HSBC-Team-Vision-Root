import React, { useState, useEffect, useCallback } from "react";
import Modal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { User } from "../../reducers/usersSlice";
import { getAuth } from "firebase/auth";
import { modalStyle, modalColumnStyle, modalListItemStyle, modalStackStyle } from "../../styles/Style";
import { Button, Grid, IconButton, Tooltip } from "@mui/material";
import { darkNewMeetingGreen, newMeetingGreen } from "../../styles/Colors";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

interface EditCollectionModalProps {
  open: boolean;
  onClose: (employees: User[]) => void;
  title: string;
  subtitle1: string;
  subtitle2: string;
  submitHandler: (employees: User[], name: string) => void;
  submitButtonText: string;
  existingCollection: User[];
  isGroup: boolean;
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

export interface GetLocationData {
  action: string;
  body: {
    users: string[];
  };
}

export interface LocationData {
  [UserId: string]: string;
}

export interface IncomingLocationData {
  UserId: string;
  location: string;
}

const EditCollectionModal = ({
  open,
  onClose,
  title,
  subtitle1,
  subtitle2,
  submitHandler,
  submitButtonText,
  existingCollection,
  isGroup,
  socket,
  connected,
}: EditCollectionModalProps) => {
  const users = useSelector((state: RootState) => state.users.usersList);
  const [employees, setEmployees] = useState<User[]>([]);
  const [addedEmployees, setAddedEmployees] = useState<User[]>([]);
  const [employeesSearch, setEmployeesSearch] = useState("");
  const [addedEmployeesSearch, setAddedEmployeesSearch] = useState("");
  const [addedEmployeeLocations, setAddedEmployeeLocations] = useState<LocationData>({});
  const auth = getAuth();

  useEffect(() => {
    setEmployees(
      users.filter(
        (e) =>
          auth.currentUser?.uid !== e.UserID &&
          !existingCollection.some((employee) => employee.UserID === e.UserID)
      )
    );
  }, [users, existingCollection]);

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);

    if (data.userLocations) {
      console.log(data);
      const locations = data.userLocations.reduce(
        (o: LocationData, user: IncomingLocationData) => ({ ...o, [user.UserId]: user.location }),
        {} as LocationData
      );
      setAddedEmployeeLocations(locations);
    }
  }, []);

  useEffect(() => {
    setAddedEmployees(existingCollection);

    if (connected && open) {
      socket.current?.addEventListener("message", onSocketMessage, false);

      const dataToSend: GetLocationData = {
        action: "getUserLocations",
        body: {
          users: existingCollection.map((employee) => employee.UserID),
        },
      };
      socket.current?.send(JSON.stringify(dataToSend));
    }

    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [existingCollection, connected, open]);

  const addToCollection = (employee: User) => {
    setAddedEmployees([...addedEmployees, employee]);

    if (connected) {
      const dataToSend: GetLocationData = {
        action: "getUserLocations",
        body: {
          users: [...addedEmployees, employee].map((employee) => employee.UserID),
        },
      };

      socket.current?.send(JSON.stringify(dataToSend));
    }

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
    // For groups, reset modal if user removes all members
    if (isGroup && addedEmployees.length === 0) {
      setAddedEmployees(existingCollection);
      setEmployees(
        users.filter(
          (e) =>
            auth.currentUser?.uid !== e.UserID &&
            !existingCollection.some((employee) => employee.UserID === e.UserID)
        )
      );
    }
    onClose(addedEmployees);
  };

  const submitModal = () => {
    submitHandler([...addedEmployees], title);
    closeModal();
  };

  const helpString = isGroup
    ? "Click on an employee on the left to add them to the group. Click on an employee on the right to remove them from the group. You cannot have an empty group."
    : "Click on an employee on the left to add them to your favourites. Click on an employee on the right to remove them from your favourites.";

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
            <Typography>
              {subtitle2} {`(${addedEmployees.length})`}
            </Typography>
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
                    onClick={() => removeFromCollection(employee)}
                    sx={{ ...modalListItemStyle, display: "flex", justifyContent: "space-between" }}
                  >
                    <Typography variant="body1">{employee.name}</Typography>
                    <Tooltip title={addedEmployeeLocations[employee.UserID] || ""} placement="top" arrow>
                      <Typography noWrap variant="body1" sx={{ maxWidth: "45%" }}>
                        {addedEmployeeLocations[employee.UserID]}
                      </Typography>
                    </Tooltip>
                  </Box>
                ))}
            </Paper>
          </Stack>
        </Stack>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Tooltip disableFocusListener disableTouchListener placement="right" title={helpString}>
            <IconButton sx={{ marginTop: "12px" }}>
              <QuestionMarkIcon sx={{ color: "grey" }} />
            </IconButton>
          </Tooltip>

          {!isGroup && (
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
          )}
        </Box>
      </Box>
    </Modal>
  );
};

export default EditCollectionModal;
