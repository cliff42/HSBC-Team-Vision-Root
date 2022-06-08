import * as React from "react";
import { Box, Checkbox, Container, FormControlLabel, IconButton, Paper, Typography } from "@mui/material";
import {
  Scheduler,
  DayView,
  WeekView,
  MonthView,
  Appointments,
  AppointmentTooltip,
  ViewSwitcher,
  Toolbar,
  DateNavigator,
  TodayButton,
  CurrentTimeIndicator,
} from "@devexpress/dx-react-scheduler-material-ui";
import Header from "../components/header/Header";
import { useState, useEffect, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import { ViewState, AppointmentModel } from "@devexpress/dx-react-scheduler";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import VideocamIcon from "@mui/icons-material/Videocam";
import ArrowCircleRightOutlinedIcon from "@mui/icons-material/ArrowCircleRightOutlined";
import CircularProgress from "@mui/material/CircularProgress";
import { User } from "../reducers/usersSlice";
import { getAuth } from "firebase/auth";
import { styled } from "@mui/material/styles";
import Tooltip, { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import QuestionMarkIcon from "@mui/icons-material/QuestionMark";

const currentDate = new Date();

interface CalendarProps {
  socket: React.MutableRefObject<WebSocket | null>;
  connected: boolean;
}

interface Recording {
  endTime: string;
  startTime: string;
  link: string;
}

const Appointment = ({ children, style, ...restProps }: any) => {
  return (
    <Appointments.Appointment {...restProps}>
      {children}
      {children[1].props.data.recordings && (
        <VideocamIcon color="action" sx={{ paddingLeft: "5px", marginTop: "-4px" }} />
      )}
    </Appointments.Appointment>
  );
};

const CustomWidthTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))({
  [`& .${tooltipClasses.tooltip}`]: {
    maxWidth: 500,
  },
});

const Content = ({ children, appointmentData, ...restProps }: any) => {
  const localTime = new Date();
  const appointmentEndTime = new Date(appointmentData.endDate);

  return (
    <AppointmentTooltip.Content {...restProps} appointmentData={appointmentData}>
      {appointmentData.link && appointmentEndTime.getTime() >= localTime.getTime() && (
        <Container
          sx={{
            display: "flex",
            flexDirection: "row",
            marginLeft: "-4px",
            marginBottom: "5px",
          }}
        >
          <ArrowCircleRightOutlinedIcon color="action" />
          <a href={appointmentData.link} target="_blank" rel="noreferrer" style={{ paddingLeft: "20px" }}>
            <Typography>Meeting Link</Typography>
          </a>
        </Container>
      )}

      {appointmentData.recordings && (
        <Container
          sx={{
            display: "flex",
            flexDirection: "row",
            marginLeft: "-3px",
            marginBottom: "5px",
          }}
        >
          <VideocamIcon color="action" />
          <ul
            style={{
              maxHeight: "100px",
              width: "100%",
              overflow: "auto",
              margin: 0,
              paddingLeft: "33px",
            }}
          >
            {appointmentData?.recordings?.map((recording: Recording, index: number) => (
              <li key={recording.link}>
                <Box sx={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}>
                  <a href={recording.link} target="_blank" rel="noreferrer">
                    <Typography>Recording Link {index + 1}</Typography>
                  </a>
                  <Typography>Password: {appointmentData.recordingsPassword}</Typography>
                </Box>
              </li>
            ))}
          </ul>
        </Container>
      )}

      {appointmentData.participants && (
        <Container sx={{ display: "flex", flexDirection: "row", marginLeft: "-3px" }}>
          <PeopleAltIcon color="action" />
          <ul
            style={{
              maxHeight: "100px",
              width: "100%",
              overflow: "auto",
              margin: 0,
              paddingLeft: "33px",
            }}
          >
            {appointmentData?.participants?.map((participant: User) => (
              <li key={participant.UserID}>
                <Typography variant="body1">{participant.name}</Typography>
              </li>
            ))}
          </ul>
        </Container>
      )}
    </AppointmentTooltip.Content>
  );
};

export default function Calendar({ socket, connected }: CalendarProps) {
  const users = useSelector((state: RootState) => state.users.usersList);
  const [cachedCurrentUserMeetings, setCachedCurrentUserMeetings] = useState<Array<AppointmentModel>>([]);
  const [scheduledMeetings, setScheduledMeetings] = useState<Array<AppointmentModel> | null>(null);
  const [filterRecordings, setFilterRecordings] = useState(false);
  const auth = getAuth();

  const onSocketMessage = useCallback((dataStr) => {
    const data = JSON.parse(dataStr.data);

    if (data.calendarMeetings) {
      console.log(data);
      const localTimeZoneMeetings = data.calendarMeetings?.filter(
        (meeting: AppointmentModel | null) => meeting
      );
      setCachedCurrentUserMeetings(localTimeZoneMeetings);
      setScheduledMeetings(localTimeZoneMeetings);
    }

    if (data.userCalendarMeetings) {
      console.log(data);
      setScheduledMeetings(data.userCalendarMeetings?.filter((meeting: AppointmentModel | null) => meeting));
    }
  }, []);

  useEffect(() => {
    if (connected) {
      socket.current?.addEventListener("message", onSocketMessage, false);
      socket.current?.send(JSON.stringify({ action: "getOwnCalendarMeetings" }));
    }
    return () => {
      socket.current?.removeEventListener("message", onSocketMessage, false);
    };
  }, [connected]);

  const searchOptions = (): Set<string> => {
    const searchDict = new Set<string>();
    const currentUserID = auth.currentUser?.uid;
    users.forEach((user) => {
      if (currentUserID !== user.UserID) searchDict.add(user.name);
    });
    return searchDict;
  };

  const searchHandler = (searchString: string) => {
    console.log("Search string: ", searchString);

    if (connected && searchString.length === 0) {
      setScheduledMeetings(cachedCurrentUserMeetings);
      return;
    }

    setScheduledMeetings(null);

    let userID = "";
    if (
      !users.some((user) => {
        if (user.name === searchString) userID = user.UserID;
        return user.name === searchString;
      })
    ) {
      return;
    }

    if (connected) {
      socket.current?.send(JSON.stringify({ action: "getUserCalendarMeetings", UserID: userID }));
    }
  };

  const filteredMeetings = filterRecordings
    ? scheduledMeetings?.filter((meeting) => meeting.recordings != null)
    : scheduledMeetings;

  return (
    <Container maxWidth={false}>
      <Header
        title="Calendar"
        socket={socket}
        connected={connected}
        searchProps={{
          searchDict: searchOptions(),
          searchHandler: searchHandler,
          reactiveSearch: false,
          searchPlaceholder: "Search by employee name",
        }}
        showSort={false}
        showFilter={false}
        showSearchBar={true}
      />

      {filteredMeetings == null ? (
        <Box>
          <CircularProgress size={100} />
        </Box>
      ) : (
        <>
          <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
            <FormControlLabel
              value={filterRecordings}
              onChange={() => {
                setFilterRecordings(!filterRecordings);
              }}
              control={<Checkbox />}
              label="Recordings Only"
              labelPlacement="end"
            />
          </Box>
          <Paper>
            <Scheduler data={filteredMeetings || []} height={Math.max(400, window.innerHeight - 180)}>
              <ViewState defaultCurrentDate={currentDate} defaultCurrentViewName="Week" />
              <DayView startDayHour={0} endDayHour={24} />
              <WeekView startDayHour={0} endDayHour={24} />
              <MonthView />

              <Toolbar />
              <DateNavigator />
              <TodayButton />
              <ViewSwitcher />
              <Appointments appointmentComponent={Appointment} />
              <AppointmentTooltip contentComponent={Content} />
              <CurrentTimeIndicator
                shadePreviousCells={true}
                shadePreviousAppointments={true}
                updateInterval={2000}
              />
            </Scheduler>
          </Paper>
        </>
      )}

      <CustomWidthTooltip
        disableFocusListener
        disableTouchListener
        placement="right"
        title="Scheduled meetings appear as blue boxes in the calendar. Click on a meeting to view more information about it, including participants, meeting link, and recordings. Look up another employee's name in the search bar to view their availabilities."
      >
        <IconButton sx={{ position: "fixed", bottom: 10, left: 310 }}>
          <QuestionMarkIcon sx={{ color: "grey" }} />
        </IconButton>
      </CustomWidthTooltip>
    </Container>
  );
}
