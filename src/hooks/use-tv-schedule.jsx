import * as React from "react";

/** Minimum viewport width for the TV fit-to-screen schedule layout */
export const TV_SCHEDULE_MIN_WIDTH = 1020;

export function useIsTvSchedule() {
  const [isTv, setIsTv] = React.useState(
    () =>
      typeof window !== "undefined" &&
      window.innerWidth >= TV_SCHEDULE_MIN_WIDTH,
  );

  React.useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${TV_SCHEDULE_MIN_WIDTH}px)`);
    const onChange = () => setIsTv(mq.matches);
    mq.addEventListener("change", onChange);
    setIsTv(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isTv;
}
