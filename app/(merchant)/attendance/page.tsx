import type { Metadata } from "next";
import { AttendanceView } from "@/app/components/merchant/views/AttendanceView";

export const metadata: Metadata = { title: "Attendance · PayCrew" };

export default function Page() {
  return <AttendanceView />;
}
