import { route } from "@/server/http";
import * as router from "@/server/modules/versions/router";

export const POST = route(router.compare);
