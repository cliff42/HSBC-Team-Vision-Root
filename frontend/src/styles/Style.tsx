import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    primary: {
      main: "#d72b2d",
    },
    secondary: {
      main: "#fcd766",
      dark: "#debd52",
    },
    success: {
      main: "#23c272",
    },
  },
});

export const sizes = {
  tileSize: "200px",
  groupsButtonSize: "25px",
  enterCallButtonSize: "50px",
  membersButtonSize: "35px",
};

export const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "50%",
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

export const modalColumnStyle = {
  padding: "4.5%",
  height: "100%",
  textAlign: "left",
  borderRadius: 5,
  border: "1px solid black",
  overflow: "auto",
};

export const modalListItemStyle = {
  paddingLeft: "5px",
  paddingRight: "5px",
  borderRadius: 1,
  "&:hover": {
    backgroundColor: "lightgrey",
  },
};

export const modalStackStyle = {
  width: "100%",
  height: "70%",
  maxHeight: "82%",
  marginTop: "10px",
  flexGrow: 4,
  paddingBottom: "10px",
};
