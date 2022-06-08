let permission = Notification.permission;

const showNotification = (title: string, body: string) => {
  if (Notification.permission === "granted") {
    // const title = "HSBC Team Vision";
    const icon = "https://logos-world.net/wp-content/uploads/2021/02/HSBC-Symbol.png";
    const notification = new Notification(title, { body, icon });
    notification.onclick = () => {
      notification.close();
      window.parent.focus();
    };
  } else {
    requestPermission();
  }
};

const requestPermission = () => {
  Notification.requestPermission().then((p) => (permission = p));
};

if (permission !== "granted") {
  requestPermission();
}

export default showNotification;
