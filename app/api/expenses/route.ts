import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expenseSchema } from "@/lib/validations";
import { startOfMonth, endOfMonth, parse } from "date-fns";
import { seedDefaultExpenseCategories } from "@/lib/expense-categories";
import { getOwnerIdForAccountant } from "@/lib/accountant-session";
import { getTeamContext } from "@/lib/team-session";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const teamCtx = await getTeamContext(session);
  const accountantOwnerId = teamCtx ? null : await getOwnerIdForAccountant(session.user.email);
  const effectiveUserId = teamCtx?.ownerId ?? accountantOwnerId ?? user.id;

  if (!teamCtx && !accountantOwnerId) {
    await seedDefaultExpenseCategories(user.id);
  }

  const { searchParams } = new URL(req.url);
  const monthParam = searchParams.get("month");
  const categoryId = searchParams.get("categoryId");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = 50;

  let dateFilter: { gte: Date; lte: Date };
  if (monthParam) {
    const parsed = parse(monthParam, "yyyy-MM", new Date());
    dateFilter = { gte: startOfMonth(parsed), lte: endOfMonth(parsed) };
  } else {
    const now = new Date();
    dateFilter = { gte: startOfMonth(now), lte: endOfMonth(now) };
  }

  const where: Record<string, unknown> = {
    userId: effectiveUserId,
    date: dateFilter,
  };
  if (categoryId) where.categoryId = categoryId;

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where: where as any,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { category: { select: { id: true, name: true, color: true } } },
    }),
    prisma.expense.count({ where: where as any }),
  ]);

  const categories = await prisma.expenseCategory.findMany({
    where: { userId: effectiveUserId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ expenses, total, page, categories });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const teamCtx = await getTeamContext(session);
  if (teamCtx?.role === "viewer") {
    return NextResponse.json({ error: "Read-only access." }, { status: 403 });
  }
  const accountantOwnerId = teamCtx ? null : await getOwnerIdForAccountant(session.user.email);
  if (accountantOwnerId) {
    return NextResponse.json({ error: "Accountant access is read-only." }, { status: 403 });
  }

  const effectiveUserId = teamCtx?.ownerId ?? user.id;

  const body = await req.json();
  const parsed = expenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { categoryId, ...data } = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      ...data,
      date: new Date(data.date),
      categoryId: categoryId || null,
      userId: effectiveUserId,
    },
    include: { category: { select: { id: true, name: true, color: true } } },
  });

  return NextResponse.json({ expense }, { status: 201 });
}
