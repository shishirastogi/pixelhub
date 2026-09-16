import { route } from "@/server/http";
import * as router from "@/server/modules/comments/router";

export const POST = route(router.convertToTask);
