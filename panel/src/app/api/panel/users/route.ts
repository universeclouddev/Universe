import { NextResponse } from "next/server";
import { getSession } from "@/lib/panel/session";
import { roleHasPermission } from "@/lib/panel/permissions";
import {
  createUser,
  deleteUser,
  isPrimaryUser,
  listUsers,
  updateUser,
  type PanelUser,
} from "@/lib/panel/users";

async function requireUsersManage() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!roleHasPermission(session.role, "users.manage")) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}

export async function GET() {
  const auth = await requireUsersManage();
  if (auth.error) return auth.error;
  const users: PanelUser[] = listUsers();
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      isPrimary: isPrimaryUser(u),
      hasPassword: u.hasPassword,
      oidcSubject: u.oidcSubject,
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireUsersManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    email?: string;
    name?: string;
    password?: string;
    role?: "admin" | "operator" | "viewer";
  };

  if (!body.email || !body.name || !body.password) {
    return NextResponse.json({ error: "email, name, and password required" }, { status: 400 });
  }

  try {
    const user = await createUser({
      email: body.email,
      name: body.name,
      password: body.password,
      role: body.role ?? "viewer",
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "User already exists" }, { status: 409 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireUsersManage();
  if (auth.error) return auth.error;

  const body = (await request.json()) as {
    id?: string;
    name?: string;
    role?: "admin" | "operator" | "viewer";
    password?: string;
  };

  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (isPrimaryUser({ id: body.id }) && body.role !== undefined) {
    return NextResponse.json({ error: "Primary account role cannot be changed" }, { status: 400 });
  }

  if (body.id === auth.session!.sub && body.role && body.role !== auth.session!.role) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 400 });
  }

  const user = updateUser(body.id, {
    name: body.name,
    role: body.role,
    password: body.password,
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

export async function DELETE(request: Request) {
  const auth = await requireUsersManage();
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (id === auth.session!.sub) {
    return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
  }
  if (isPrimaryUser({ id })) {
    return NextResponse.json({ error: "Primary account cannot be deleted" }, { status: 400 });
  }

  if (!deleteUser(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
