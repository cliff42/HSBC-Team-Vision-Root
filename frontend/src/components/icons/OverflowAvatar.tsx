import { Avatar, styled } from "@mui/material";
import { alertYellow } from "../../styles/Colors";

const SmallFontAvatar = styled(Avatar)`
  font-size: 70%;
`;
const LargeFontAvatar = styled(Avatar)`
  font-size: 95%;
`;

function stringAvatar(size: number) {
  return {
    sx: {
      bgcolor: alertYellow,
      color: "black",
      fontWeight: 700,
    },
    children: `+${size}`,
  };
}

export interface OverflowAvatarProps {
  size: number;
}

export default function OverflowAvatar({ size }: OverflowAvatarProps) {
  return size >= 1000 ? <SmallFontAvatar {...stringAvatar(size)} /> : <LargeFontAvatar {...stringAvatar(size)} />;
}
