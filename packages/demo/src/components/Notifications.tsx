import { ChevronsRightLeft, History } from "lucide-react";
import { ReactNode, useEffect, useState } from "react";
import { Message } from "./Message";

interface NotificationProps {
  messages: ["info" | "warn" | "error", string, ReactNode][];
}

export function Notifications({ messages }: NotificationProps) {
  const [[msgCount, isExpanded], setMsgsState] = useState([0, false]);
  const [shownMsgCount, setShownMsgCount] = useState(0);

  useEffect(() => {
    setShownMsgCount(messages.length);
    const newMsgCount = messages.length - shownMsgCount;
    if (newMsgCount <= 0) {
      return;
    }

    if (!isExpanded) {
      setMsgsState([newMsgCount, true]);
    }
    if (isExpanded && msgCount !== 0) {
      setMsgsState([msgCount + newMsgCount, true]);
    }

    setTimeout(
      () =>
        setMsgsState(([count, i]) => {
          if (count === 0) {
            return [count, i];
          }

          if (count === newMsgCount) {
            return [count, false];
          }
          return [count - newMsgCount, i];
        }),
      3000,
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const toggleExpand = () => {
    if (!isExpanded) {
      setMsgsState([0, true]);
    } else {
      setMsgsState([msgCount, false]);
    }
  };

  return (
    <>
      {messages.length > 0 ? (
        <div
          className="fixed top-28 right-0 z-50 mb-4 flex cursor-pointer items-center rounded-l-full border border-gray-200 bg-white px-3 py-2 shadow-md md:top-16"
          onClick={toggleExpand}
        >
          {isExpanded ? (
            <ChevronsRightLeft className="h-8 w-8" />
          ) : (
            <History className="h-8 w-8" />
          )}
          <span className="mx-3 flex items-center justify-center rounded-full text-lg">
            {messages.length}
          </span>
        </div>
      ) : undefined}

      <div
        className={`fixed top-44 right-0 z-40 max-h-[60vh] w-full md:top-32 md:w-7/12 lg:w-5/12 xl:w-4/12 ${isExpanded ? "" : "translate-x-full"} flex flex-col overflow-x-hidden overflow-y-auto border border-gray-200 bg-white duration-300 ease-in-out md:rounded-lg md:shadow-lg`}
      >
        <div className="p-4">
          {messages
            .slice(0, msgCount === 0 ? messages.length : msgCount)
            .map(([level, title, msg], i) => (
              <Message
                key={messages.length - i}
                title={`${messages.length - i} ${title}`}
                type={
                  { info: "success", warn: "warning", error: "error" }[
                    level
                  ] as "success" | "warning" | "error"
                }
              >
                {msg}
              </Message>
            ))}
        </div>
      </div>
    </>
  );
}
