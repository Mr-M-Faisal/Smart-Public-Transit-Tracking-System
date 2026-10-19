import SettingsScreen from "../../../components/settings/SettingsScreen";
import { version } from "../../../../package.json";
export default function Page() { return <SettingsScreen section="about" version={version} />; }
