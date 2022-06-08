import { Avatar } from "@mui/material";
import { alertYellow } from "../../styles/Colors";

function stringAvatar(name: string) {
  return {
    sx: {
      bgcolor: alertYellow,
    },
    children: `${name.split(" ")[0][0]}${name.split(" ")[1][0]}`,
  };
}

export interface EmployeeAvatarProps {
  name: string;
}

export default function EmployeeAvatar({ name }: EmployeeAvatarProps) {
  return <Avatar {...stringAvatar(name)} />;
}
