import { route } from "@/server/http";
import * as router from "@/server/modules/comments/router";

export const GET = route(router.listForFile);
