import React from "react";
import { useSelector } from "react-redux";
import { RootState } from "../../store";
import { Alert, AlertColor } from "@mui/material";

interface AlertProps {
  type: AlertColor;
}

const Notification = ({ type }: AlertProps) => {
  const message = useSelector((state: RootState) => state.notification.message);

  return <>{message && <Alert severity={type}>{message}</Alert>}</>;
};

export default Notification;
