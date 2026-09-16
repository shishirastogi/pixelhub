import { route } from "@/server/http";
import * as router from "@/server/modules/files/router";

export const GET = route(router.list);
