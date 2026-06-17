import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import zhCnLocale from "@fullcalendar/core/locales/zh-cn";
import { auth, db } from "./firebase";
import "./App.css";

type Priority = "high" | "middle" | "low";
type CompanyStatus = "active" | "waiting" | "passed" | "rejected" | "declined";
type FlowStatus = "done" | "current" | "todo" | "failed";
type TimeMode = "none" | "deadline" | "schedule";
type AppPage = "companies" | "calendar" | "materials";


type MaterialCategory =
  | "self_analysis"
  | "interview_questions"
  | "es"
  | "company_research"
  | "job_type_research"
  | "self_pr"
  | "gakuchika"
  | "research_content"
  | "failure_experience"
  | "reverse_questions"
  | "self_introduction"
  | "career_axis";

type TextMaterial = {
  id: string;
  title: string;
  category: MaterialCategory;
  subcategory: string;
  body: string;
  companyName: string;
  memo: string;
  createdAt?: any;
  updatedAt?: any;
};

type TextMaterialForm = {
  title: string;
  category: MaterialCategory;
  subcategory: string;
  body: string;
  companyName: string;
  memo: string;
};

type MaterialSubcategory = {
  id: string;
  parentCategory: MaterialCategory;
  name: string;
  createdAt?: any;
  updatedAt?: any;
};

type PersonalMaterialKind = string;

type PersonalMaterialCategory = {
  id: string;
  name: string;
  createdAt?: any;
  updatedAt?: any;
};

type PersonalMaterialFile = {
  id: string;
  name: string;
  fileUrl: string;
  kind: PersonalMaterialKind;
  memo: string;
  createdAt?: any;
  updatedAt?: any;
};

type FlowItem = {
  id: number;
  title: string;
  status: FlowStatus;
  timeMode: TimeMode;
  deadline: string;
  start: string;
  end: string;
  location: string;
  url: string;
  memo: string;
};

type Company = {
  id: string;
  name: string;
  position: string;
  priority: Priority;
  status: CompanyStatus;
  myPageUrl?: string;
  loginId?: string;
  loginPassword?: string;
  memo?: string;
  flowItems: FlowItem[];
};

type CompanyForm = {
  name: string;
  position: string;
  priority: Priority;
  myPageUrl: string;
  loginId: string;
  loginPassword: string;
  memo: string;
  flowItems: FlowItem[];
};

type OldStep = {
  id?: number;
  name?: string;
  status?: string;
};

type OldEvent = {
  id?: number;
  title?: string;
  start?: string;
  end?: string;
  memo?: string;
};

type OldCurrentTask = {
  title?: string;
  timeMode?: string;
  deadline?: string;
  start?: string;
  end?: string;
  memo?: string;
  status?: string;
};

type OldTask = {
  id?: number;
  title?: string;
  timeMode?: string;
  deadline?: string;
  start?: string;
  end?: string;
  memo?: string;
  status?: string;
};

const createEmptyForm = (): CompanyForm => ({
  name: "",
  position: "",
  priority: "middle",
  myPageUrl: "",
  loginId: "",
  loginPassword: "",
  memo: "",
  flowItems: [],
});

const createEmptyFlowItem = (): FlowItem => ({
  id: Date.now(),
  title: "",
  status: "todo",
  timeMode: "none",
  deadline: "",
  start: "",
  end: "",
  location: "",
  url: "",
  memo: "",
});


const materialCategoryOptions: {
  value: MaterialCategory;
  label: string;
  description: string;
  icon: string;
}[] = [
  { value: "self_analysis", label: "自我分析", description: "性格、价值观、强项弱项、经验整理", icon: "🧭" },
  { value: "interview_questions", label: "面试问题集", description: "把面试问题作为标题，正文保存回答稿", icon: "💬" },
  { value: "es", label: "ES", description: "ES 答案、志望动机、公司别提交稿", icon: "📝" },
  { value: "company_research", label: "企业研究表", description: "企业业务、强项、竞合、志望理由素材", icon: "🏢" },
  { value: "job_type_research", label: "职种研究表", description: "生产技术、开发、SE 等职种理解", icon: "🧪" },
  { value: "self_pr", label: "自己PR素材库", description: "强项、理由、具体例、学到的东西", icon: "⭐" },
  { value: "gakuchika", label: "ガクチカ素材库", description: "学生时代努力过的事、STAR 结构素材", icon: "🔥" },
  { value: "research_content", label: "研究内容说明", description: "研究概要、难点、方法、成果、意义", icon: "🔬" },
  { value: "failure_experience", label: "挫折・失败经历素材库", description: "失败经验、改善行动、学到的教训", icon: "🌱" },
  { value: "reverse_questions", label: "逆質問问题集", description: "把想问的问题作为标题，正文保存补充说明", icon: "❓" },
  { value: "self_introduction", label: "自我介绍", description: "30 秒、1 分钟、日语/中文自我介绍", icon: "🙋" },
  { value: "career_axis", label: "就活轴", description: "选公司标准、行业偏好、职业目标", icon: "🎯" },
];

const DEFAULT_PERSONAL_MATERIAL_CATEGORY = "其他";

const legacyPersonalMaterialKindLabels: Record<string, string> = {
  photo: "照片 / 图片",
  resume: "履历书 / 简历",
  certificate: "证明材料",
  portfolio: "作品集 / 其他提交材料",
  other: "其他",
};

const createEmptyTextMaterialForm = (
  category: MaterialCategory = "self_analysis",
): TextMaterialForm => ({
  title: "",
  category,
  subcategory: "其他",
  body: "",
  companyName: "",
  memo: "",
});

function getMaterialCategoryLabel(category: MaterialCategory) {
  return (
    materialCategoryOptions.find((item) => item.value === category)?.label ??
    "其他"
  );
}

function normalizePersonalMaterialKind(value: string | undefined): PersonalMaterialKind {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return DEFAULT_PERSONAL_MATERIAL_CATEGORY;

  return legacyPersonalMaterialKindLabels[trimmed] ?? trimmed;
}

function getPersonalMaterialKindLabel(kind: PersonalMaterialKind) {
  return normalizePersonalMaterialKind(kind);
}

function normalizeMaterialFileUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  return `https://${trimmed}`;
}


function normalizeSubcategoryName(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || "其他";
}

function normalizeMaterialCategory(value: string | undefined): MaterialCategory {
  if (
    value === "self_analysis" ||
    value === "interview_questions" ||
    value === "es" ||
    value === "company_research" ||
    value === "job_type_research" ||
    value === "self_pr" ||
    value === "gakuchika" ||
    value === "research_content" ||
    value === "failure_experience" ||
    value === "reverse_questions" ||
    value === "self_introduction" ||
    value === "career_axis"
  ) {
    return value;
  }

  if (value === "interview") return "interview_questions";
  if (value === "motivation") return "es";
  if (value === "reverse_question") return "reverse_questions";
  if (value === "research") return "research_content";

  return "self_analysis";
}

function formatFirestoreDate(value: any) {
  if (!value) return "";

  if (typeof value.toDate === "function") {
    return value.toDate().toLocaleString();
  }

  return formatDateTime(String(value));
}


function escapePrintHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return "登录或注册失败";

  if (error.message.includes("auth/email-already-in-use")) {
    return "这个邮箱已经注册过了";
  }

  if (error.message.includes("auth/invalid-email")) {
    return "邮箱格式不正确";
  }

  if (error.message.includes("auth/weak-password")) {
    return "密码请设置为 6 位以上";
  }

  if (
    error.message.includes("auth/invalid-credential") ||
    error.message.includes("auth/user-not-found") ||
    error.message.includes("auth/wrong-password")
  ) {
    return "邮箱或密码不正确";
  }

  return "登录或注册失败";
}

function getPriorityLabel(priority: Priority) {
  if (priority === "high") return "高";
  if (priority === "middle") return "中";
  return "低";
}

function getStatusLabel(status: CompanyStatus) {
  if (status === "active") return "进行中";
  if (status === "waiting") return "等待结果";
  if (status === "passed") return "通过 / 内定";
  if (status === "rejected") return "落选";
  return "辞退";
}

function normalizeTimeMode(value: string | undefined): TimeMode {
  if (value === "none" || value === "deadline" || value === "schedule") {
    return value;
  }

  return "none";
}

function normalizeFlowStatus(value: string | undefined): FlowStatus {
  if (
    value === "done" ||
    value === "current" ||
    value === "todo" ||
    value === "failed"
  ) {
    return value;
  }

  if (value === "active" || value === "waiting") return "current";

  return "todo";
}

function getCurrentFlowIndex(items: FlowItem[]) {
  const currentIndex = items.findIndex((item) => item.status === "current");
  if (currentIndex >= 0) return currentIndex;

  const firstTodoIndex = items.findIndex((item) => item.status === "todo");
  if (firstTodoIndex >= 0) return firstTodoIndex;

  return items.length > 0 ? items.length - 1 : 0;
}

function getCurrentFlowItem(items: FlowItem[]) {
  if (items.length === 0) return null;
  return items[getCurrentFlowIndex(items)] ?? null;
}

function getNextFlowItem(items: FlowItem[]) {
  if (items.length === 0) return null;

  const currentIndex = getCurrentFlowIndex(items);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= items.length) return null;

  return items[nextIndex] ?? null;
}

function applyCurrentIndex(items: FlowItem[], currentIndex: number): FlowItem[] {
  return items.map((item, index) => ({
    ...item,
    status:
      index < currentIndex
        ? ("done" as FlowStatus)
        : index === currentIndex
          ? ("current" as FlowStatus)
          : ("todo" as FlowStatus),
  }));
}

function normalizeCompanyFlowItems(
  items: FlowItem[],
  companyStatus: CompanyStatus,
): FlowItem[] {
  if (items.length === 0) return [];

  if (companyStatus === "passed") {
    return items.map((item) => ({ ...item, status: "done" as FlowStatus }));
  }

  if (companyStatus === "rejected") {
    const failedIndex = items.findIndex((item) => item.status === "failed");
    const currentIndex =
      failedIndex >= 0 ? failedIndex : getCurrentFlowIndex(items);

    return items.map((item, index) => {
      if (index < currentIndex)
        return { ...item, status: "done" as FlowStatus };
      if (index === currentIndex)
        return { ...item, status: "failed" as FlowStatus };
      return { ...item, status: "todo" as FlowStatus };
    });
  }

  const currentIndex = getCurrentFlowIndex(items);
  return applyCurrentIndex(items, currentIndex);
}

function formatDateTime(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function normalizeLoadedFlowItems(data: any): FlowItem[] {
  if (Array.isArray(data.flowItems) && data.flowItems.length > 0) {
    return data.flowItems.map((item: any, index: number) => ({
      id: item.id ?? Date.now() + index,
      title: item.title ?? item.name ?? "",
      status: normalizeFlowStatus(item.status),
      timeMode: normalizeTimeMode(item.timeMode),
      deadline: item.deadline ?? "",
      start: item.start ?? "",
      end: item.end ?? "",
      location: item.location ?? "",
      url: item.url ?? "",
      memo: item.memo ?? "",
    }));
  }

  if (data.currentTask) {
    const task: OldCurrentTask = data.currentTask;

    return [
      {
        id: Date.now(),
        title: task.title ?? "",
        status: data.status === "rejected" ? "failed" : "current",
        timeMode: normalizeTimeMode(task.timeMode),
        deadline: task.deadline ?? "",
        start: task.start ?? "",
        end: task.end ?? "",
        location: "",
        url: "",
        memo: task.memo ?? "",
      },
    ];
  }

  if (Array.isArray(data.tasks) && data.tasks.length > 0) {
    return data.tasks.map((task: OldTask, index: number) => ({
      id: task.id ?? Date.now() + index,
      title: task.title ?? "",
      status: normalizeFlowStatus(task.status),
      timeMode: normalizeTimeMode(task.timeMode),
      deadline: task.deadline ?? "",
      start: task.start ?? "",
      end: task.end ?? "",
      location: "",
      url: "",
      memo: task.memo ?? "",
    }));
  }

  if (Array.isArray(data.events) && data.events.length > 0) {
    return data.events.map((event: OldEvent, index: number) => ({
      id: event.id ?? Date.now() + index,
      title: event.title ?? "",
      status: index === 0 ? "current" : "todo",
      timeMode: event.start ? "schedule" : "none",
      deadline: "",
      start: event.start ?? "",
      end: event.end ?? "",
      location: "",
      url: "",
      memo: event.memo ?? "",
    }));
  }

  if (Array.isArray(data.steps) && data.steps.length > 0) {
    return data.steps.map((step: OldStep, index: number) => ({
      id: step.id ?? Date.now() + index,
      title: step.name ?? "",
      status: normalizeFlowStatus(step.status),
      timeMode: "none",
      deadline: "",
      start: "",
      end: "",
      location: "",
      url: "",
      memo: "",
    }));
  }

  return [];
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState("");

  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(createEmptyForm);

  const [isDetailFormOpen, setIsDetailFormOpen] = useState(false);
  const [detailCompanyId, setDetailCompanyId] = useState<string | null>(null);
  const [detailItem, setDetailItem] = useState<FlowItem | null>(null);

  const [visiblePasswords, setVisiblePasswords] = useState<
    Record<string, boolean>
  >({});
  const [searchKeyword, setSearchKeyword] = useState("");
  const [activePage, setActivePage] = useState<AppPage>("companies");

  const [textMaterials, setTextMaterials] = useState<TextMaterial[]>([]);
  const [textMaterialsLoading, setTextMaterialsLoading] = useState(false);
  const [materialSubcategories, setMaterialSubcategories] = useState<
    MaterialSubcategory[]
  >([]);
  const [materialSubcategoriesLoading, setMaterialSubcategoriesLoading] =
    useState(false);
  const [isTextMaterialFormOpen, setIsTextMaterialFormOpen] = useState(false);
  const [editingTextMaterialId, setEditingTextMaterialId] = useState<
    string | null
  >(null);
  const [textMaterialForm, setTextMaterialForm] = useState<TextMaterialForm>(
    createEmptyTextMaterialForm,
  );
  const [activeMaterialCategory, setActiveMaterialCategory] =
    useState<MaterialCategory | null>(null);
  const [activeMaterialSubcategory, setActiveMaterialSubcategory] =
    useState("全部");
  const [newSubcategoryName, setNewSubcategoryName] = useState("");
  const [materialSearchKeyword, setMaterialSearchKeyword] = useState("");
  const [expandedTextMaterialId, setExpandedTextMaterialId] = useState<
    string | null
  >(null);
  const [personalMaterialFiles, setPersonalMaterialFiles] = useState<
    PersonalMaterialFile[]
  >([]);
  const [personalMaterialFilesLoading, setPersonalMaterialFilesLoading] =
    useState(false);
  const [personalMaterialCategories, setPersonalMaterialCategories] = useState<
    PersonalMaterialCategory[]
  >([]);
  const [personalMaterialCategoriesLoading, setPersonalMaterialCategoriesLoading] =
    useState(false);
  const [activePersonalMaterialsFolder, setActivePersonalMaterialsFolder] =
    useState(false);
  const [activePersonalFileKind, setActivePersonalFileKind] =
    useState("全部");
  const [newPersonalMaterialCategoryName, setNewPersonalMaterialCategoryName] =
    useState("");
  const [personalFileName, setPersonalFileName] = useState("");
  const [personalFileUrl, setPersonalFileUrl] = useState("");
  const [personalFileKind, setPersonalFileKind] =
    useState<PersonalMaterialKind>(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
  const [personalFileMemo, setPersonalFileMemo] = useState("");
  const [personalFileSearchKeyword, setPersonalFileSearchKeyword] =
    useState("");
  const [editingPersonalMaterialFileId, setEditingPersonalMaterialFileId] =
    useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setCompanies([]);
      setCompaniesLoading(false);
      return;
    }

    setCompaniesLoading(true);

    const companiesRef = collection(db, "users", user.uid, "companies");
    const companiesQuery = query(companiesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      companiesQuery,
      (snapshot) => {
        const loadedCompanies: Company[] = snapshot.docs.map((document) => {
          const data = document.data();
          const status = (data.status ?? "active") as CompanyStatus;
          const flowItems = normalizeCompanyFlowItems(
            normalizeLoadedFlowItems(data),
            status,
          );

          return {
            id: document.id,
            name: data.name ?? "",
            position: data.position ?? "",
            priority: data.priority ?? "middle",
            status,
            myPageUrl: data.myPageUrl ?? "",
            loginId: data.loginId ?? "",
            loginPassword: data.loginPassword ?? "",
            memo: data.memo ?? "",
            flowItems,
          };
        });

        setCompanies(loadedCompanies);
        setCompaniesLoading(false);
      },
      (error) => {
        console.error(error);
        setCompaniesLoading(false);
        alert("读取公司信息失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setTextMaterials([]);
      setTextMaterialsLoading(false);
      return;
    }

    setTextMaterialsLoading(true);

    const textMaterialsRef = collection(db, "users", user.uid, "textMaterials");
    const textMaterialsQuery = query(
      textMaterialsRef,
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      textMaterialsQuery,
      (snapshot) => {
        const loadedTextMaterials: TextMaterial[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              title: data.title ?? data.question ?? "",
              category: normalizeMaterialCategory(data.category),
              subcategory: normalizeSubcategoryName(data.subcategory),
              body: data.body ?? data.answer ?? "",
              companyName: data.companyName ?? "",
              memo: data.memo ?? "",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setTextMaterials(loadedTextMaterials);
        setTextMaterialsLoading(false);
      },
      (error) => {
        console.error(error);
        setTextMaterialsLoading(false);
        alert("读取文本材料失败");
      },
    );

    return () => unsubscribe();
  }, [user]);


  useEffect(() => {
    if (!user) {
      setPersonalMaterialFiles([]);
      setPersonalMaterialFilesLoading(false);
      return;
    }

    setPersonalMaterialFilesLoading(true);

    const filesRef = collection(db, "users", user.uid, "materialFiles");
    const filesQuery = query(filesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      filesQuery,
      (snapshot) => {
        const loadedFiles: PersonalMaterialFile[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              name: data.name ?? "",
              fileUrl: data.fileUrl ?? data.driveUrl ?? data.downloadUrl ?? "",
              kind: normalizePersonalMaterialKind(data.kind),
              memo: data.memo ?? "",
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setPersonalMaterialFiles(loadedFiles);
        setPersonalMaterialFilesLoading(false);
      },
      (error) => {
        console.error(error);
        setPersonalMaterialFilesLoading(false);
        alert("读取个人材料文件失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPersonalMaterialCategories([]);
      setPersonalMaterialCategoriesLoading(false);
      return;
    }

    setPersonalMaterialCategoriesLoading(true);

    const categoriesRef = collection(
      db,
      "users",
      user.uid,
      "materialFileCategories",
    );
    const categoriesQuery = query(categoriesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const loadedCategories: PersonalMaterialCategory[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              name: normalizePersonalMaterialKind(data.name),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setPersonalMaterialCategories(loadedCategories);
        setPersonalMaterialCategoriesLoading(false);
      },
      (error) => {
        console.error(error);
        setPersonalMaterialCategoriesLoading(false);
        alert("读取个人材料类别失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setMaterialSubcategories([]);
      setMaterialSubcategoriesLoading(false);
      return;
    }

    setMaterialSubcategoriesLoading(true);

    const subcategoriesRef = collection(
      db,
      "users",
      user.uid,
      "materialSubcategories",
    );
    const subcategoriesQuery = query(
      subcategoriesRef,
      orderBy("createdAt", "asc"),
    );

    const unsubscribe = onSnapshot(
      subcategoriesQuery,
      (snapshot) => {
        const loadedSubcategories: MaterialSubcategory[] = snapshot.docs.map(
          (document) => {
            const data = document.data();

            return {
              id: document.id,
              parentCategory: normalizeMaterialCategory(data.parentCategory),
              name: normalizeSubcategoryName(data.name),
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            };
          },
        );

        setMaterialSubcategories(loadedSubcategories);
        setMaterialSubcategoriesLoading(false);
      },
      (error) => {
        console.error(error);
        setMaterialSubcategoriesLoading(false);
        alert("读取词条分类失败");
      },
    );

    return () => unsubscribe();
  }, [user]);

  const filteredCompanies = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();

    if (!keyword) return companies;

    return companies.filter((company) => {
      const flowText = company.flowItems
        .map(
          (item) =>
            `${item.title} ${item.deadline} ${item.start} ${item.end} ${item.location} ${item.url} ${item.memo}`,
        )
        .join(" ");

      const targetText = [
        company.name,
        company.position,
        company.myPageUrl,
        company.loginId,
        company.memo,
        flowText,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [companies, searchKeyword]);

  const personalMaterialCategoryOptions = useMemo(() => {
    const customCategories = personalMaterialCategories
      .map((item) => normalizePersonalMaterialKind(item.name))
      .filter((name, index, array) => array.indexOf(name) === index)
      .filter((name) => name !== DEFAULT_PERSONAL_MATERIAL_CATEGORY);

    const inferredCategories = personalMaterialFiles
      .map((file) => normalizePersonalMaterialKind(file.kind))
      .filter((name, index, array) => array.indexOf(name) === index)
      .filter(
        (name) =>
          name !== DEFAULT_PERSONAL_MATERIAL_CATEGORY &&
          !customCategories.includes(name),
      );

    if (
      personalFileKind !== DEFAULT_PERSONAL_MATERIAL_CATEGORY &&
      !customCategories.includes(personalFileKind) &&
      !inferredCategories.includes(personalFileKind)
    ) {
      inferredCategories.push(personalFileKind);
    }

    return [
      DEFAULT_PERSONAL_MATERIAL_CATEGORY,
      ...customCategories,
      ...inferredCategories,
    ];
  }, [personalMaterialCategories, personalMaterialFiles, personalFileKind]);

  const personalMaterialCategoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      [DEFAULT_PERSONAL_MATERIAL_CATEGORY]: 0,
    };

    personalMaterialCategoryOptions.forEach((name) => {
      counts[name] = 0;
    });

    personalMaterialFiles.forEach((file) => {
      const name = normalizePersonalMaterialKind(file.kind);
      counts[name] = (counts[name] ?? 0) + 1;
    });

    return counts;
  }, [personalMaterialCategoryOptions, personalMaterialFiles]);

  const filteredPersonalMaterialFiles = useMemo(() => {
    const keyword = personalFileSearchKeyword.trim().toLowerCase();

    return personalMaterialFiles.filter((file) => {
      const fileKind = normalizePersonalMaterialKind(file.kind);

      if (activePersonalFileKind !== "全部" && fileKind !== activePersonalFileKind) {
        return false;
      }

      if (!keyword) return true;

      const targetText = [
        file.name,
        getPersonalMaterialKindLabel(file.kind),
        file.fileUrl,
        file.memo,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [
    personalMaterialFiles,
    personalFileSearchKeyword,
    activePersonalFileKind,
  ]);

  const activeMaterialCategoryInfo = useMemo(() => {
    if (!activeMaterialCategory) return null;

    return (
      materialCategoryOptions.find(
        (category) => category.value === activeMaterialCategory,
      ) ?? null
    );
  }, [activeMaterialCategory]);

  const materialCategoryCounts = useMemo(() => {
    return materialCategoryOptions.reduce(
      (acc, category) => {
        acc[category.value] = textMaterials.filter(
          (material) => material.category === category.value,
        ).length;
        return acc;
      },
      {} as Record<MaterialCategory, number>,
    );
  }, [textMaterials]);

  const activeSubcategoryOptions = useMemo(() => {
    if (!activeMaterialCategory) return ["其他"];

    const customSubcategories = materialSubcategories
      .filter((item) => item.parentCategory === activeMaterialCategory)
      .map((item) => item.name)
      .filter((name, index, array) => array.indexOf(name) === index)
      .filter((name) => name !== "其他");

    return ["其他", ...customSubcategories];
  }, [activeMaterialCategory, materialSubcategories]);

  const activeSubcategoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 其他: 0 };

    if (!activeMaterialCategory) return counts;

    activeSubcategoryOptions.forEach((name) => {
      counts[name] = 0;
    });

    textMaterials.forEach((material) => {
      if (material.category !== activeMaterialCategory) return;
      const name = normalizeSubcategoryName(material.subcategory);
      counts[name] = (counts[name] ?? 0) + 1;
    });

    return counts;
  }, [activeMaterialCategory, activeSubcategoryOptions, textMaterials]);

  const filteredTextMaterials = useMemo(() => {
    const keyword = materialSearchKeyword.trim().toLowerCase();

    return textMaterials.filter((material) => {
      if (activeMaterialCategory && material.category !== activeMaterialCategory) {
        return false;
      }

      if (
        activeMaterialSubcategory !== "全部" &&
        normalizeSubcategoryName(material.subcategory) !== activeMaterialSubcategory
      ) {
        return false;
      }

      if (!keyword) return true;

      const targetText = [
        material.title,
        getMaterialCategoryLabel(material.category),
        normalizeSubcategoryName(material.subcategory),
        material.body,
        material.companyName,
        material.memo,
      ]
        .join(" ")
        .toLowerCase();

      return targetText.includes(keyword);
    });
  }, [
    textMaterials,
    activeMaterialCategory,
    activeMaterialSubcategory,
    materialSearchKeyword,
  ]);

  const calendarEvents = useMemo(() => {
    return companies
      .flatMap((company) =>
        company.flowItems.map((item) => {
          if (
            company.status === "waiting" ||
            company.status === "rejected" ||
            company.status === "declined" ||
            company.status === "passed"
          ) {
            return null;
          }

          if (item.status === "done" || item.status === "failed") {
            return null;
          }

          if (item.timeMode === "deadline") {
            if (!item.deadline) return null;

            return {
              id: `${company.id}-${item.id}`,
              title: `${company.name}｜${item.title}`,
              start: item.deadline,
              extendedProps: {
                companyName: company.name,
                itemTitle: item.title,
                timeMode: "截止时间",
                location: item.location,
                url: item.url,
                memo: item.memo,
              },
            };
          }

          if (item.timeMode === "schedule") {
            if (!item.start) return null;

            return {
              id: `${company.id}-${item.id}`,
              title: `${company.name}｜${item.title}`,
              start: item.start,
              end: item.end || undefined,
              extendedProps: {
                companyName: company.name,
                itemTitle: item.title,
                timeMode: "开始结束时间",
                location: item.location,
                url: item.url,
                memo: item.memo,
              },
            };
          }

          return null;
        }),
      )
      .filter(Boolean);
  }, [companies]);

  const handleAuth = async () => {
    setAuthError("");

    if (!email || !password) {
      setAuthError("请输入邮箱和密码");
      return;
    }

    if (isRegisterMode) {
      if (password.length < 6) {
        setAuthError("密码请设置为 6 位以上");
        return;
      }

      if (password !== passwordConfirm) {
        setAuthError("两次输入的密码不一致");
        return;
      }
    }

    try {
      if (isRegisterMode) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      setPassword("");
      setPasswordConfirm("");
    } catch (error) {
      console.error(error);
      setAuthError(getAuthErrorMessage(error));
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCompanies([]);
    setIsFormOpen(false);
    setEditingCompanyId(null);
    setForm(createEmptyForm());
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setVisiblePasswords({});
    setTextMaterials([]);
    setTextMaterialsLoading(false);
    setPersonalMaterialFiles([]);
    setPersonalMaterialFilesLoading(false);
    setPersonalMaterialCategories([]);
    setPersonalMaterialCategoriesLoading(false);
    setActivePersonalMaterialsFolder(false);
    setActivePersonalFileKind("全部");
    setNewPersonalMaterialCategoryName("");
    setPersonalFileName("");
    setPersonalFileUrl("");
    setPersonalFileKind(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
    setPersonalFileMemo("");
    setPersonalFileSearchKeyword("");
    setEditingPersonalMaterialFileId(null);
    setMaterialSubcategories([]);
    setMaterialSubcategoriesLoading(false);
    setActiveMaterialSubcategory("全部");
    setNewSubcategoryName("");
    setIsTextMaterialFormOpen(false);
    setEditingTextMaterialId(null);
    setTextMaterialForm(createEmptyTextMaterialForm());
    setActiveMaterialCategory(null);
    setMaterialSearchKeyword("");
    setActivePage("companies");
  };

  const updateFormField = <K extends keyof CompanyForm>(
    field: K,
    value: CompanyForm[K],
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateFlowTitle = (itemId: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      flowItems: prev.flowItems.map((item) =>
        item.id === itemId ? { ...item, title: value } : item,
      ),
    }));
  };

  const updateDetailItem = <K extends keyof FlowItem>(
    field: K,
    value: FlowItem[K],
  ) => {
    setDetailItem((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const addFlowItem = () => {
    setForm((prev) => ({
      ...prev,
      flowItems: [...prev.flowItems, createEmptyFlowItem()],
    }));
  };

  const deleteFlowItem = (itemId: number) => {
    setForm((prev) => {
      const nextItems = prev.flowItems.filter((item) => item.id !== itemId);

      if (nextItems.length === 0) {
        return {
          ...prev,
          flowItems: [],
        };
      }

      return {
        ...prev,
        flowItems: normalizeCompanyFlowItems(nextItems, "active"),
      };
    });
  };

  const resetForm = () => {
    setForm(createEmptyForm());
    setEditingCompanyId(null);
  };

  const openAddForm = () => {
    resetForm();
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setIsFormOpen(true);
  };

  const openEditForm = (company: Company) => {
    setForm({
      name: company.name,
      position: company.position,
      priority: company.priority,
      myPageUrl: company.myPageUrl ?? "",
      loginId: company.loginId ?? "",
      loginPassword: company.loginPassword ?? "",
      memo: company.memo ?? "",
      flowItems: company.flowItems.map((item, index) => ({
        id: item.id || Date.now() + index,
        title: item.title,
        status: item.status,
        timeMode: item.timeMode,
        deadline: item.deadline,
        start: item.start,
        end: item.end,
        location: item.location,
        url: item.url,
        memo: item.memo,
      })),
    });

    setEditingCompanyId(company.id);
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCurrentDetailForm = (company: Company) => {
    const currentItem = getCurrentFlowItem(company.flowItems);

    if (!currentItem) {
      alert("当前没有流程节点");
      return;
    }

    setIsFormOpen(false);
    setEditingCompanyId(null);
    setDetailCompanyId(company.id);
    setDetailItem({ ...currentItem });
    setIsDetailFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeDetailForm = () => {
    setIsDetailFormOpen(false);
    setDetailCompanyId(null);
    setDetailItem(null);
  };

  const saveCompany = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    if (!form.name.trim()) {
      alert("请输入公司名");
      return;
    }

    const validFlowItems = form.flowItems
      .filter((item) => item.title.trim() !== "")
      .map((item, index) => ({
        id: item.id || Date.now() + index,
        title: item.title.trim(),
        status: item.status,
        timeMode: item.timeMode,
        deadline: item.deadline,
        start: item.start,
        end: item.end,
        location: item.location.trim(),
        url: item.url.trim(),
        memo: item.memo.trim(),
      }));

    if (validFlowItems.length === 0) {
      alert("请至少输入一个流程节点");
      return;
    }

    const normalizedFlowItems = normalizeCompanyFlowItems(
      validFlowItems,
      "active",
    );

    const companyData = {
      name: form.name.trim(),
      position: form.position.trim(),
      priority: form.priority,
      status: editingCompanyId ? undefined : "active",
      myPageUrl: form.myPageUrl.trim(),
      loginId: form.loginId.trim(),
      loginPassword: form.loginPassword,
      memo: form.memo.trim(),
      flowItems: normalizedFlowItems,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingCompanyId) {
        const companyRef = doc(
          db,
          "users",
          user.uid,
          "companies",
          editingCompanyId,
        );
        await updateDoc(companyRef, {
          name: companyData.name,
          position: companyData.position,
          priority: companyData.priority,
          myPageUrl: companyData.myPageUrl,
          loginId: companyData.loginId,
          loginPassword: companyData.loginPassword,
          memo: companyData.memo,
          flowItems: companyData.flowItems,
          updatedAt: companyData.updatedAt,
        });
      } else {
        await addDoc(collection(db, "users", user.uid, "companies"), {
          ...companyData,
          status: "active",
          createdAt: serverTimestamp(),
        });
      }

      resetForm();
      setIsFormOpen(false);
    } catch (error) {
      console.error(error);
      alert("保存公司信息失败");
    }
  };

  const saveCurrentDetail = async () => {
    if (!user || !detailCompanyId || !detailItem) return;

    const company = companies.find((item) => item.id === detailCompanyId);

    if (!company) {
      alert("找不到公司信息");
      return;
    }

    const nextFlowItems = company.flowItems.map((item) =>
      item.id === detailItem.id
        ? {
            ...item,
            timeMode: detailItem.timeMode,
            deadline: detailItem.deadline,
            start: detailItem.start,
            end: detailItem.end,
            location: detailItem.location.trim(),
            url: detailItem.url.trim(),
            memo: detailItem.memo.trim(),
          }
        : item,
    );

    try {
      const companyRef = doc(
        db,
        "users",
        user.uid,
        "companies",
        detailCompanyId,
      );
      await updateDoc(companyRef, {
        flowItems: nextFlowItems,
        updatedAt: serverTimestamp(),
      });

      closeDetailForm();
    } catch (error) {
      console.error(error);
      alert("保存当前阶段详情失败");
    }
  };

  const removeCompany = async (company: Company) => {
    if (!user) return;

    const ok = window.confirm(`确定要删除 ${company.name} 吗？`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "companies", company.id));
    } catch (error) {
      console.error(error);
      alert("删除公司信息失败");
    }
  };

  const completeCurrentFlowItem = async (company: Company) => {
    if (!user) return;

    const currentItem = getCurrentFlowItem(company.flowItems);

    if (!currentItem) return;

    const ok = window.confirm(
      `确定「${currentItem.title}」已经完成，并等待结果吗？`,
    );
    if (!ok) return;

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);

      await updateDoc(companyRef, {
        status: "waiting",
        flowItems: company.flowItems,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("更新为等待结果失败");
    }
  };

  const passCurrentFlowItem = async (company: Company) => {
    if (!user) return;

    const currentIndex = getCurrentFlowIndex(company.flowItems);
    const currentItem = company.flowItems[currentIndex];

    if (!currentItem) return;

    const nextItem = getNextFlowItem(company.flowItems);
    const ok = window.confirm(
      nextItem
        ? `确定「${currentItem.title}」结果通过，并进入「${nextItem.title}」吗？`
        : `确定「${currentItem.title}」结果通过，并结束全部流程吗？`,
    );

    if (!ok) return;

    const nextIndex = currentIndex + 1;

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);

      if (nextIndex >= company.flowItems.length) {
        await updateDoc(companyRef, {
          status: "passed",
          flowItems: company.flowItems.map((item) => ({
            ...item,
            status: "done" as FlowStatus,
          })),
          updatedAt: serverTimestamp(),
        });
        return;
      }

      await updateDoc(companyRef, {
        status: "active",
        flowItems: applyCurrentIndex(company.flowItems, nextIndex),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("推进流程失败");
    }
  };

  const failCurrentFlowItem = async (company: Company) => {
    if (!user) return;

    const currentIndex = getCurrentFlowIndex(company.flowItems);
    const currentItem = company.flowItems[currentIndex];

    if (!currentItem) return;

    const ok = window.confirm(
      `确定「${currentItem.title}」失败，并将 ${company.name} 标记为落选吗？`,
    );
    if (!ok) return;

    const updatedFlowItems = company.flowItems.map((item, index) => {
      if (index < currentIndex)
        return { ...item, status: "done" as FlowStatus };
      if (index === currentIndex)
        return { ...item, status: "failed" as FlowStatus };
      return { ...item, status: "todo" as FlowStatus };
    });

    try {
      const companyRef = doc(db, "users", user.uid, "companies", company.id);
      await updateDoc(companyRef, {
        status: "rejected",
        flowItems: updatedFlowItems,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("标记落选失败");
    }
  };

  const toggleCompanyPassword = (companyId: string) => {
    setVisiblePasswords((prev) => ({
      ...prev,
      [companyId]: !prev[companyId],
    }));
  };

  const updateTextMaterialFormField = <K extends keyof TextMaterialForm>(
    field: K,
    value: TextMaterialForm[K],
  ) => {
    setTextMaterialForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const resetTextMaterialForm = (category = activeMaterialCategory) => {
    setTextMaterialForm(createEmptyTextMaterialForm(category ?? "self_analysis"));
    setEditingTextMaterialId(null);
  };

  const openMaterialCategory = (category: MaterialCategory) => {
    setActiveMaterialCategory(category);
    setActiveMaterialSubcategory("全部");
    setNewSubcategoryName("");
    setMaterialSearchKeyword("");
    setExpandedTextMaterialId(null);
    setIsTextMaterialFormOpen(false);
    setEditingTextMaterialId(null);
    setTextMaterialForm(createEmptyTextMaterialForm(category));
  };

  const closeMaterialCategory = () => {
    setActiveMaterialCategory(null);
    setActiveMaterialSubcategory("全部");
    setNewSubcategoryName("");
    setMaterialSearchKeyword("");
    setExpandedTextMaterialId(null);
    setIsTextMaterialFormOpen(false);
    resetTextMaterialForm(null);
  };

  const createMaterialSubcategory = async () => {
    if (!user || !activeMaterialCategory) return;

    const name = normalizeSubcategoryName(newSubcategoryName);

    if (name === "其他") {
      alert("“其他”是默认分类，不需要重复新建");
      return;
    }

    if (activeSubcategoryOptions.includes(name)) {
      alert("这个分类已经存在");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "materialSubcategories"), {
        parentCategory: activeMaterialCategory,
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewSubcategoryName("");
      setActiveMaterialSubcategory(name);
    } catch (error) {
      console.error(error);
      alert("新建词条分类失败");
    }
  };

  const deleteMaterialSubcategory = async (name: string) => {
    if (!user || !activeMaterialCategory) return;

    if (name === "其他") {
      alert("默认分类“其他”不能删除");
      return;
    }

    const materialsInSubcategory = textMaterials.filter(
      (material) =>
        material.category === activeMaterialCategory &&
        normalizeSubcategoryName(material.subcategory) === name,
    );

    const ok = window.confirm(
      materialsInSubcategory.length > 0
        ? `确定删除分类「${name}」吗？其中 ${materialsInSubcategory.length} 条词条会移动到「其他」。`
        : `确定删除分类「${name}」吗？`,
    );

    if (!ok) return;

    try {
      await Promise.all(
        materialsInSubcategory.map((material) =>
          updateDoc(doc(db, "users", user.uid, "textMaterials", material.id), {
            subcategory: "其他",
            updatedAt: serverTimestamp(),
          }),
        ),
      );

      const subcategoriesToDelete = materialSubcategories.filter(
        (subcategory) =>
          subcategory.parentCategory === activeMaterialCategory &&
          subcategory.name === name,
      );

      await Promise.all(
        subcategoriesToDelete.map((subcategory) =>
          deleteDoc(
            doc(db, "users", user.uid, "materialSubcategories", subcategory.id),
          ),
        ),
      );

      if (activeMaterialSubcategory === name) {
        setActiveMaterialSubcategory("全部");
      }
    } catch (error) {
      console.error(error);
      alert("删除词条分类失败");
    }
  };

  const openAddTextMaterialForm = () => {
    if (!activeMaterialCategory) {
      alert("请先进入一个材料分类");
      return;
    }

    resetTextMaterialForm(activeMaterialCategory);
    setIsTextMaterialFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openEditTextMaterialForm = (material: TextMaterial) => {
    setTextMaterialForm({
      title: material.title,
      category: material.category,
      subcategory: normalizeSubcategoryName(material.subcategory),
      body: material.body,
      companyName: material.companyName,
      memo: material.memo,
    });
    setEditingTextMaterialId(material.id);
    setIsTextMaterialFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeTextMaterialForm = () => {
    resetTextMaterialForm();
    setIsTextMaterialFormOpen(false);
  };

  const saveTextMaterial = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    const title = textMaterialForm.title.trim();
    const subcategory = normalizeSubcategoryName(textMaterialForm.subcategory);
    const body = textMaterialForm.body.trim();

    if (!title) {
      alert("请输入标题");
      return;
    }

    if (!subcategory) {
      alert("请选择词条分类");
      return;
    }

    if (!body) {
      alert("请填写回答或正文内容");
      return;
    }

    const materialData = {
      title,
      category: textMaterialForm.category,
      subcategory,
      body,
      companyName: textMaterialForm.companyName.trim(),
      memo: textMaterialForm.memo.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingTextMaterialId) {
        const materialRef = doc(
          db,
          "users",
          user.uid,
          "textMaterials",
          editingTextMaterialId,
        );
        await updateDoc(materialRef, materialData);
      } else {
        await addDoc(collection(db, "users", user.uid, "textMaterials"), {
          ...materialData,
          createdAt: serverTimestamp(),
        });
      }

      closeTextMaterialForm();
    } catch (error) {
      console.error(error);
      alert("保存文本材料失败");
    }
  };

  const removeTextMaterial = async (material: TextMaterial) => {
    if (!user) return;

    const ok = window.confirm(`确定要删除「${material.title}」吗？`);
    if (!ok) return;

    try {
      await deleteDoc(
        doc(db, "users", user.uid, "textMaterials", material.id),
      );
      setExpandedTextMaterialId((prev) =>
        prev === material.id ? null : prev,
      );
    } catch (error) {
      console.error(error);
      alert("删除文本材料失败");
    }
  };

  const openPersonalMaterialsFolder = () => {
    setActivePersonalMaterialsFolder(true);
    setActivePersonalFileKind("全部");
    setPersonalFileSearchKeyword("");
  };

  const closePersonalMaterialsFolder = () => {
    setActivePersonalMaterialsFolder(false);
    setActivePersonalFileKind("全部");
    setNewPersonalMaterialCategoryName("");
    setPersonalFileSearchKeyword("");
    resetPersonalMaterialForm();
  };

  const createPersonalMaterialCategory = async () => {
    if (!user) return;

    const name = normalizePersonalMaterialKind(newPersonalMaterialCategoryName);

    if (name === DEFAULT_PERSONAL_MATERIAL_CATEGORY) {
      alert("“其他”是默认类别，不需要重复新建");
      return;
    }

    if (personalMaterialCategoryOptions.includes(name)) {
      alert("这个类别已经存在");
      return;
    }

    try {
      await addDoc(collection(db, "users", user.uid, "materialFileCategories"), {
        name,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setNewPersonalMaterialCategoryName("");
      setActivePersonalFileKind(name);
      setPersonalFileKind(name);
    } catch (error) {
      console.error(error);
      alert("新建个人材料类别失败");
    }
  };

  const deletePersonalMaterialCategory = async (name: string) => {
    if (!user) return;

    if (name === DEFAULT_PERSONAL_MATERIAL_CATEGORY) {
      alert("默认类别“其他”不能删除");
      return;
    }

    const filesInCategory = personalMaterialFiles.filter(
      (file) => normalizePersonalMaterialKind(file.kind) === name,
    );

    const ok = window.confirm(
      filesInCategory.length > 0
        ? `确定删除类别「${name}」吗？其中 ${filesInCategory.length} 条个人材料会移动到「其他」。`
        : `确定删除类别「${name}」吗？`,
    );

    if (!ok) return;

    try {
      await Promise.all(
        filesInCategory.map((file) =>
          updateDoc(doc(db, "users", user.uid, "materialFiles", file.id), {
            kind: DEFAULT_PERSONAL_MATERIAL_CATEGORY,
            updatedAt: serverTimestamp(),
          }),
        ),
      );

      const categoriesToDelete = personalMaterialCategories.filter(
        (category) => normalizePersonalMaterialKind(category.name) === name,
      );

      await Promise.all(
        categoriesToDelete.map((category) =>
          deleteDoc(
            doc(db, "users", user.uid, "materialFileCategories", category.id),
          ),
        ),
      );

      if (activePersonalFileKind === name) {
        setActivePersonalFileKind("全部");
      }

      if (personalFileKind === name) {
        setPersonalFileKind(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
      }
    } catch (error) {
      console.error(error);
      alert("删除个人材料类别失败");
    }
  };

  const resetPersonalMaterialForm = () => {
    setPersonalFileName("");
    setPersonalFileUrl("");
    setPersonalFileKind(DEFAULT_PERSONAL_MATERIAL_CATEGORY);
    setPersonalFileMemo("");
    setEditingPersonalMaterialFileId(null);
  };

  const openEditPersonalMaterialFile = (file: PersonalMaterialFile) => {
    setPersonalFileName(file.name);
    setPersonalFileUrl(file.fileUrl);
    setPersonalFileKind(normalizePersonalMaterialKind(file.kind));
    setPersonalFileMemo(file.memo);
    setEditingPersonalMaterialFileId(file.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const savePersonalMaterialFile = async () => {
    if (!user) {
      alert("请先登录");
      return;
    }

    const name = personalFileName.trim();
    const fileUrl = normalizeMaterialFileUrl(personalFileUrl);

    if (!name) {
      alert("请输入材料名称");
      return;
    }

    if (!fileUrl) {
      alert("请输入 Google Drive 或其他网盘链接");
      return;
    }

    const materialData = {
      name,
      fileUrl,
      kind: normalizePersonalMaterialKind(personalFileKind),
      memo: personalFileMemo.trim(),
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingPersonalMaterialFileId) {
        await updateDoc(
          doc(
            db,
            "users",
            user.uid,
            "materialFiles",
            editingPersonalMaterialFileId,
          ),
          materialData,
        );
      } else {
        await addDoc(collection(db, "users", user.uid, "materialFiles"), {
          ...materialData,
          createdAt: serverTimestamp(),
        });
      }

      resetPersonalMaterialForm();
    } catch (error) {
      console.error(error);
      alert("保存个人材料链接失败");
    }
  };

  const removePersonalMaterialFile = async (file: PersonalMaterialFile) => {
    if (!user) return;

    const ok = window.confirm(`确定要删除个人材料「${file.name}」吗？`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "users", user.uid, "materialFiles", file.id));

      if (editingPersonalMaterialFileId === file.id) {
        resetPersonalMaterialForm();
      }
    } catch (error) {
      console.error(error);
      alert("删除个人材料失败");
    }
  };

  const toggleTextMaterialDetail = (materialId: string) => {
    setExpandedTextMaterialId((prev) =>
      prev === materialId ? null : materialId,
    );
  };

  const buildTextMaterialsPrintHtml = (
    materials: TextMaterial[],
    title: string,
  ) => {
    const exportedAt = new Date().toLocaleString();
    const materialSections = materials
      .map((material, index) => {
        const companyLine = material.companyName
          ? `<div class="meta-line"><strong>关联公司：</strong>${escapePrintHtml(material.companyName)}</div>`
          : "";
        const memoBlock = material.memo
          ? `<div class="memo-block"><strong>备注：</strong><div>${escapePrintHtml(material.memo)}</div></div>`
          : "";
        const createdLine = formatFirestoreDate(material.createdAt)
          ? `<span>创建：${escapePrintHtml(formatFirestoreDate(material.createdAt))}</span>`
          : "";
        const updatedLine = formatFirestoreDate(material.updatedAt)
          ? `<span>更新：${escapePrintHtml(formatFirestoreDate(material.updatedAt))}</span>`
          : "";

        return `
          <article class="print-material-card">
            <div class="print-card-index">${index + 1}</div>
            <h2>${escapePrintHtml(material.title)}</h2>
            <div class="meta-line"><strong>大类：</strong>${escapePrintHtml(getMaterialCategoryLabel(material.category))}</div>
            <div class="meta-line"><strong>词条分类：</strong>${escapePrintHtml(normalizeSubcategoryName(material.subcategory))}</div>
            ${companyLine}
            <div class="body-block">${escapePrintHtml(material.body)}</div>
            ${memoBlock}
            <div class="date-row">${createdLine}${updatedLine}</div>
          </article>
        `;
      })
      .join("");

    return `
      <!doctype html>
      <html lang="zh-CN">
        <head>
          <meta charset="utf-8" />
          <title>${escapePrintHtml(title)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              padding: 36px;
              color: #111827;
              background: #ffffff;
              font-family: Arial, "Hiragino Sans", "Yu Gothic", "Microsoft YaHei", sans-serif;
              line-height: 1.65;
            }
            .print-page-title {
              margin: 0;
              font-size: 28px;
              letter-spacing: -0.03em;
            }
            .print-subtitle {
              margin: 8px 0 28px;
              color: #667085;
              font-size: 13px;
            }
            .print-material-card {
              position: relative;
              page-break-inside: avoid;
              border: 1px solid #e5e7eb;
              border-radius: 18px;
              padding: 22px 24px;
              margin: 0 0 18px;
            }
            .print-card-index {
              position: absolute;
              top: 18px;
              right: 18px;
              min-width: 30px;
              height: 30px;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              border-radius: 999px;
              background: #f2f4f7;
              color: #667085;
              font-size: 12px;
              font-weight: 700;
            }
            h2 {
              margin: 0 40px 12px 0;
              font-size: 22px;
              line-height: 1.35;
            }
            .meta-line {
              margin: 4px 0;
              color: #475467;
              font-size: 13px;
            }
            .body-block {
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
              white-space: pre-wrap;
              font-size: 15px;
            }
            .memo-block {
              margin-top: 16px;
              padding: 12px 14px;
              border-radius: 12px;
              background: #f8f9fb;
              color: #475467;
              font-size: 13px;
              white-space: pre-wrap;
            }
            .date-row {
              display: flex;
              justify-content: flex-end;
              gap: 12px;
              margin-top: 14px;
              color: #98a2b3;
              font-size: 11px;
            }
            @media print {
              body { padding: 22mm 18mm; }
              .print-material-card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1 class="print-page-title">${escapePrintHtml(title)}</h1>
          <p class="print-subtitle">导出时间：${escapePrintHtml(exportedAt)} / 共 ${materials.length} 条</p>
          ${materialSections}
        </body>
      </html>
    `;
  };

  const openPrintPdfWindow = (_title: string, html: string) => {
    const printWindow = window.open("", "_blank", "width=960,height=720");

    if (!printWindow) {
      alert("浏览器阻止了弹出窗口。请允许弹出窗口后再试一次。");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const exportTextMaterialsToPdf = (materials: TextMaterial[], title: string) => {
    if (materials.length === 0) {
      alert("当前没有可以导出的词条");
      return;
    }

    openPrintPdfWindow(title, buildTextMaterialsPrintHtml(materials, title));
  };

  const exportCurrentTextMaterialsToPdf = () => {
    if (!activeMaterialCategoryInfo) return;

    const subcategoryText =
      activeMaterialSubcategory === "全部"
        ? "全部"
        : activeMaterialSubcategory;
    const searchText = materialSearchKeyword.trim()
      ? ` / 搜索：${materialSearchKeyword.trim()}`
      : "";

    exportTextMaterialsToPdf(
      filteredTextMaterials,
      `${activeMaterialCategoryInfo.label} / ${subcategoryText}${searchText}`,
    );
  };

  const exportSingleTextMaterialToPdf = (material: TextMaterial) => {
    exportTextMaterialsToPdf(
      [material],
      `${getMaterialCategoryLabel(material.category)} / ${material.title}`,
    );
  };

  if (authLoading) {
    return <div className="auth-page">加载中...</div>;
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <h1>JobFlow</h1>
          <p>请登录后管理你的求职进度和公司账号信息。</p>

          <label>
            邮箱
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="example@gmail.com"
            />
          </label>

          <label>
            密码
            <div className="inline-input-button">
              <input
                type={showAuthPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="至少 6 位"
              />
              <button
                type="button"
                className="mini-button"
                onClick={() => setShowAuthPassword((prev) => !prev)}
              >
                {showAuthPassword ? "隐藏" : "显示"}
              </button>
            </div>
          </label>

          {isRegisterMode && (
            <label>
              确认密码
              <input
                type={showAuthPassword ? "text" : "password"}
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                placeholder="请再输入一次密码"
              />
            </label>
          )}

          {authError && <p className="error-text">{authError}</p>}

          <button className="primary-button auth-button" onClick={handleAuth}>
            {isRegisterMode ? "注册" : "登录"}
          </button>

          <button
            className="text-button"
            onClick={() => {
              setIsRegisterMode((prev) => !prev);
              setAuthError("");
              setPassword("");
              setPasswordConfirm("");
            }}
          >
            {isRegisterMode ? "已有账号？点击登录" : "第一次使用？点击注册"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <header className="header app-header-row">
        <div>
          <h1>JobFlow</h1>
          <p>求职进度、DDL、面试安排和公司账号信息管理工具</p>
          <p className="login-user">当前登录：{user.email}</p>
        </div>

        <button className="secondary-button" onClick={handleLogout}>
          退出登录
        </button>
      </header>

      <section className="module-nav">
        <button
          className={`module-tab ${activePage === "companies" ? "active" : ""}`}
          onClick={() => setActivePage("companies")}
        >
          公司管理
        </button>

        <button
          className={`module-tab ${activePage === "calendar" ? "active" : ""}`}
          onClick={() => setActivePage("calendar")}
        >
          日历
        </button>

        <button
          className={`module-tab ${activePage === "materials" ? "active" : ""}`}
          onClick={() => setActivePage("materials")}
        >
          材料库
        </button>
      </section>

      {activePage === "companies" && (
        <>
          <section className="toolbar toolbar-row">
            <button onClick={openAddForm}>＋添加公司</button>

            <input
              className="search-input"
              value={searchKeyword}
              onChange={(event) => setSearchKeyword(event.target.value)}
              placeholder="按公司名、职位、备注、流程节点等搜索"
            />
          </section>

          {isFormOpen && (
            <section className="form-card">
              <div className="form-header">
                <h2>{editingCompanyId ? "编辑公司" : "添加公司"}</h2>
                <button
                  className="secondary-button"
                  onClick={() => {
                    resetForm();
                    setIsFormOpen(false);
                  }}
                >
                  关闭
                </button>
              </div>

              <div className="form-grid">
                <label>
                  公司名
                  <input
                    value={form.name}
                    onChange={(event) =>
                      updateFormField("name", event.target.value)
                    }
                    placeholder="例：株式会社〇〇"
                  />
                </label>

                <label>
                  应聘职位
                  <input
                    value={form.position}
                    onChange={(event) =>
                      updateFormField("position", event.target.value)
                    }
                    placeholder="例：综合职 / 技术职 / 设计师"
                  />
                </label>

                <label>
                  优先度
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      updateFormField(
                        "priority",
                        event.target.value as Priority,
                      )
                    }
                  >
                    <option value="high">高</option>
                    <option value="middle">中</option>
                    <option value="low">低</option>
                  </select>
                </label>

                <label>
                  My Page 网址
                  <input
                    value={form.myPageUrl}
                    onChange={(event) =>
                      updateFormField("myPageUrl", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </label>

                <label>
                  My Page 登录 ID / 邮箱
                  <input
                    value={form.loginId}
                    onChange={(event) =>
                      updateFormField("loginId", event.target.value)
                    }
                    placeholder="邮箱或登录 ID"
                  />
                </label>

                <label>
                  My Page 密码
                  <input
                    type="password"
                    value={form.loginPassword}
                    onChange={(event) =>
                      updateFormField("loginPassword", event.target.value)
                    }
                    placeholder="密码"
                  />
                </label>
              </div>

              <label className="memo-field">
                公司备注
                <textarea
                  value={form.memo}
                  onChange={(event) =>
                    updateFormField("memo", event.target.value)
                  }
                  placeholder="志望动机、企业特点、准备事项等"
                />
              </label>

              <div className="flow-editor">
                <div className="steps-editor-header">
                  <h3>选考流程线</h3>
                  <button className="secondary-button" onClick={addFlowItem}>
                    ＋添加节点
                  </button>
                </div>

                {form.flowItems.length === 0 && (
                  <p className="form-hint">
                    还没有流程节点。请点击“＋添加节点”，只需要先填写大概的流程标题。
                  </p>
                )}

                {form.flowItems.map((item, index) => (
                  <div className="flow-title-row" key={item.id}>
                    <span className="flow-title-index">{index + 1}</span>

                    <input
                      value={item.title}
                      onChange={(event) =>
                        updateFlowTitle(item.id, event.target.value)
                      }
                      placeholder="例：会社説明会 / ES提出 / 一面"
                    />

                    <button
                      className="danger-button"
                      onClick={() => deleteFlowItem(item.id)}
                    >
                      删除
                    </button>
                  </div>
                ))}

                <p className="form-hint">
                  添加公司时只需要设置流程标题。时间、地点、URL、备注等细节，之后在公司卡片里点击“编辑当前阶段详情”补充。
                </p>
              </div>

              <div className="form-actions">
                <button className="primary-button" onClick={saveCompany}>
                  {editingCompanyId ? "更新" : "添加"}
                </button>
              </div>
            </section>
          )}

          {isDetailFormOpen && detailItem && (
            <section className="form-card">
              <div className="form-header">
                <h2>编辑当前阶段详情</h2>
                <button className="secondary-button" onClick={closeDetailForm}>
                  关闭
                </button>
              </div>

              <div className="current-detail-title">
                <strong>当前阶段：</strong>
                <span>{detailItem.title}</span>
              </div>

              <div className="event-editor-grid">
                <label>
                  时间形式
                  <select
                    value={detailItem.timeMode}
                    onChange={(event) =>
                      updateDetailItem(
                        "timeMode",
                        event.target.value as TimeMode,
                      )
                    }
                  >
                    <option value="none">不设置时间</option>
                    <option value="deadline">截止时间</option>
                    <option value="schedule">开始结束时间</option>
                  </select>
                </label>

                {detailItem.timeMode === "deadline" && (
                  <label>
                    截止时间
                    <input
                      type="datetime-local"
                      value={detailItem.deadline}
                      onChange={(event) =>
                        updateDetailItem("deadline", event.target.value)
                      }
                    />
                  </label>
                )}

                {detailItem.timeMode === "schedule" && (
                  <>
                    <label>
                      开始时间
                      <input
                        type="datetime-local"
                        value={detailItem.start}
                        onChange={(event) =>
                          updateDetailItem("start", event.target.value)
                        }
                      />
                    </label>

                    <label>
                      结束时间，可选
                      <input
                        type="datetime-local"
                        value={detailItem.end}
                        onChange={(event) =>
                          updateDetailItem("end", event.target.value)
                        }
                      />
                    </label>
                  </>
                )}

                <label>
                  地点
                  <input
                    value={detailItem.location}
                    onChange={(event) =>
                      updateDetailItem("location", event.target.value)
                    }
                    placeholder="例：WEB / 東京本社 / Zoom"
                  />
                </label>

                <label>
                  URL / Zoom
                  <input
                    value={detailItem.url}
                    onChange={(event) =>
                      updateDetailItem("url", event.target.value)
                    }
                    placeholder="https://..."
                  />
                </label>
              </div>

              <label className="memo-field">
                阶段备注
                <textarea
                  value={detailItem.memo}
                  onChange={(event) =>
                    updateDetailItem("memo", event.target.value)
                  }
                  placeholder="提交方式、携带材料、面试官信息、注意事项等"
                />
              </label>

              <div className="form-actions">
                <button className="primary-button" onClick={saveCurrentDetail}>
                  保存详情
                </button>
              </div>
            </section>
          )}

          <section className="company-list">
            {companiesLoading && <div className="empty-card">加载中...</div>}

            {!companiesLoading && companies.length === 0 && (
              <div className="empty-card">
                还没有公司信息。请先点击“＋添加公司”进行登记。
              </div>
            )}

            {!companiesLoading &&
              companies.length > 0 &&
              filteredCompanies.length === 0 && (
                <div className="empty-card">没有找到符合搜索条件的公司。</div>
              )}

            {!companiesLoading &&
              filteredCompanies.map((company) => {
                const currentItem = getCurrentFlowItem(company.flowItems);
                const nextItem = getNextFlowItem(company.flowItems);

                return (
                  <article className="company-card" key={company.id}>
                    <div className="company-header">
                      <div>
                        <h2>{company.name}</h2>
                        <p>{company.position || "未填写职位"}</p>
                        <div className="badge-row">
                          <span
                            className={`badge priority-${company.priority}`}
                          >
                            优先度：{getPriorityLabel(company.priority)}
                          </span>
                          <span className={`badge status-${company.status}`}>
                            {getStatusLabel(company.status)}
                          </span>
                        </div>
                      </div>

                      <div className="card-side">
                        <div className="card-actions">
                          <button
                            className="secondary-button"
                            onClick={() => openEditForm(company)}
                          >
                            编辑公司
                          </button>
                          <button
                            className="danger-button"
                            onClick={() => removeCompany(company)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>

                    {company.flowItems.length > 0 ? (
                      <div className="flow">
                        {company.flowItems.map((item, index) => (
                          <div
                            className="step-wrap"
                            key={`${company.id}-${item.id}`}
                          >
                            <span className={`step ${item.status}`}>
                              {item.title}
                            </span>
                            {index < company.flowItems.length - 1 && (
                              <span className="arrow">→</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-card">还没有设置选考流程。</div>
                    )}

                    {currentItem && (
                      <div className="current-flow-card">
                        {company.status === "waiting" ? (
                          <>
                            <div className="stage-status-row">
                              <span className="stage-label-inline">已完成</span>
                              <span className="stage-pill done-pill">
                                {currentItem.title}
                              </span>
                            </div>

                            <div className="stage-status-row">
                              <span className="stage-label-inline">
                                是否顺利进入
                              </span>
                              <span className="stage-pill next-pill">
                                {nextItem ? nextItem.title : "最终结果"}
                              </span>
                            </div>

                            <div className="task-result-actions">
                              <button
                                className="success-button"
                                onClick={() => passCurrentFlowItem(company)}
                              >
                                成功
                              </button>
                              <button
                                className="danger-button"
                                onClick={() => failCurrentFlowItem(company)}
                              >
                                失败
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="stage-status-row">
                              <span className="stage-label-inline">
                                {currentItem.status === "failed"
                                  ? "落选"
                                  : "当前阶段"}
                              </span>
                              <span
                                className={`stage-pill ${
                                  currentItem.status === "failed"
                                    ? "failed-pill"
                                    : "current-pill"
                                }`}
                              >
                                {currentItem.title}
                              </span>
                            </div>

                            {currentItem.timeMode === "deadline" &&
                              currentItem.deadline && (
                                <p>
                                  <strong>截止时间：</strong>
                                  {formatDateTime(currentItem.deadline)}
                                </p>
                              )}

                            {currentItem.timeMode === "schedule" &&
                              currentItem.start && (
                                <p>
                                  <strong>时间：</strong>
                                  {formatDateTime(currentItem.start)}
                                  {currentItem.end
                                    ? ` ～ ${formatDateTime(currentItem.end)}`
                                    : ""}
                                </p>
                              )}

                            {currentItem.location && (
                              <p>
                                <strong>地点：</strong>
                                {currentItem.location}
                              </p>
                            )}

                            {currentItem.url && (
                              <p>
                                <strong>URL：</strong>
                                <a
                                  href={currentItem.url}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {currentItem.url}
                                </a>
                              </p>
                            )}

                            {currentItem.memo && (
                              <p>
                                <strong>备注：</strong>
                                {currentItem.memo}
                              </p>
                            )}

                            {company.status === "active" &&
                              currentItem.status === "current" && (
                                <div className="task-result-actions">
                                  <button
                                    className="secondary-button"
                                    onClick={() =>
                                      openCurrentDetailForm(company)
                                    }
                                  >
                                    编辑当前阶段详情
                                  </button>
                                  <button
                                    className="success-button"
                                    onClick={() =>
                                      completeCurrentFlowItem(company)
                                    }
                                  >
                                    已完成
                                  </button>
                                  <button
                                    className="danger-button"
                                    onClick={() => failCurrentFlowItem(company)}
                                  >
                                    失败
                                  </button>
                                </div>
                              )}
                          </>
                        )}
                      </div>
                    )}

                    {company.status === "passed" && (
                      <div className="current-flow-card">
                        <div className="stage-status-row">
                          <span className="stage-label-inline">
                            全部流程已完成
                          </span>
                          <span className="stage-pill done-pill">
                            通过 / 内定
                          </span>
                        </div>
                      </div>
                    )}

                    {company.status === "rejected" && (
                      <div className="current-flow-card">
                        <div className="stage-status-row">
                          <span className="stage-label-inline">结果</span>
                          <span className="stage-pill failed-pill">落选</span>
                        </div>
                      </div>
                    )}

                    <div className="company-extra">
                      {company.myPageUrl && (
                        <p>
                          <strong>My Page：</strong>
                          <a
                            href={company.myPageUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {company.myPageUrl}
                          </a>
                        </p>
                      )}

                      {company.loginId && (
                        <p>
                          <strong>登录 ID：</strong>
                          {company.loginId}
                        </p>
                      )}

                      {company.loginPassword && (
                        <p className="password-row">
                          <strong>密码：</strong>
                          <span>
                            {visiblePasswords[company.id]
                              ? company.loginPassword
                              : "••••••••••••"}
                          </span>
                          <button
                            className="mini-button"
                            onClick={() => toggleCompanyPassword(company.id)}
                          >
                            {visiblePasswords[company.id] ? "隐藏" : "显示"}
                          </button>
                        </p>
                      )}

                      {company.memo && (
                        <p>
                          <strong>备注：</strong>
                          {company.memo}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
          </section>
        </>
      )}

      {activePage === "calendar" && (
        <section className="calendar-section">
          <div className="calendar-header">
            <h2>日历</h2>
            <p>流程节点中设置了时间的未完成事项会自动显示在这里。</p>
          </div>

          <div className="calendar-card">
            <FullCalendar
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              locales={[zhCnLocale]}
              locale="zh-cn"
              initialView="dayGridMonth"
              height="auto"
              events={calendarEvents as any}
              headerToolbar={{
                left: "prev,next today",
                center: "title",
                right: "dayGridMonth,timeGridWeek,timeGridDay",
              }}
              buttonText={{
                today: "今天",
                month: "月",
                week: "周",
                day: "日",
              }}
              eventClick={(info) => {
                const props = info.event.extendedProps;

                alert(
                  [
                    `公司：${props.companyName}`,
                    `事项：${props.itemTitle}`,
                    `时间形式：${props.timeMode}`,
                    `开始：${info.event.start?.toLocaleString() ?? ""}`,
                    `结束：${info.event.end?.toLocaleString() ?? "未设置"}`,
                    props.location ? `地点：${props.location}` : "",
                    props.url ? `URL：${props.url}` : "",
                    props.memo ? `备注：${props.memo}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                );
              }}
            />
          </div>
        </section>
      )}

      {activePage === "materials" && (
        <section className="materials-page">
          {!activeMaterialCategory && !activePersonalMaterialsFolder && (
            <>
              <section className="personal-folder-row">
                <button
                  className="material-folder-card personal-material-folder-card"
                  type="button"
                  onClick={openPersonalMaterialsFolder}
                >
                  <span className="material-folder-icon">📁</span>
                  <span className="material-folder-content">
                    <strong>个人材料</strong>
                    <small>登记 Google Drive、Dropbox、OneDrive 等网盘链接</small>
                  </span>
                  <span className="material-folder-count">
                    {personalMaterialFiles.length} 条
                  </span>
                </button>
              </section>

              <section className="material-folder-grid">
                {materialCategoryOptions.map((category) => (
                  <button
                    className="material-folder-card"
                    key={category.value}
                    type="button"
                    onClick={() => openMaterialCategory(category.value)}
                  >
                    <span className="material-folder-icon">{category.icon}</span>
                    <span className="material-folder-content">
                      <strong>{category.label}</strong>
                      <small>{category.description}</small>
                    </span>
                    <span className="material-folder-count">
                      {materialCategoryCounts[category.value] ?? 0} 条
                    </span>
                  </button>
                ))}
              </section>
            </>
          )}

          {activePersonalMaterialsFolder && (
            <>
              <div className="materials-header materials-header-row">
                <div>
                  <button
                    className="text-button back-folder-button"
                    type="button"
                    onClick={closePersonalMaterialsFolder}
                  >
                    ← 返回材料库
                  </button>
                  <h2>
                    <span className="folder-title-icon">📁</span>
                    个人材料
                  </h2>
                  <p>登记 Google Drive、Dropbox、OneDrive 等网盘链接。文件本体放在网盘里，JobFlow 只保存名称、类别、链接和备注。</p>
                </div>
              </div>

              <section className="subcategory-panel personal-material-category-panel">
                <div className="subcategory-panel-header">
                  <div>
                    <h3>材料类别</h3>
                    <p>默认类别是「其他」。你可以自己新建类别，删除类别时其中的材料会移动到「其他」。</p>
                  </div>
                  {personalMaterialCategoriesLoading && <span>类别读取中...</span>}
                </div>

                <div className="subcategory-tabs">
                  <button
                    type="button"
                    className={`subcategory-tab ${
                      activePersonalFileKind === "全部" ? "active" : ""
                    }`}
                    onClick={() => setActivePersonalFileKind("全部")}
                  >
                    全部
                    <span>{personalMaterialFiles.length}</span>
                  </button>

                  {personalMaterialCategoryOptions.map((name) => (
                    <div className="subcategory-tab-wrap" key={name}>
                      <button
                        type="button"
                        className={`subcategory-tab ${
                          activePersonalFileKind === name ? "active" : ""
                        }`}
                        onClick={() => setActivePersonalFileKind(name)}
                      >
                        {name}
                        <span>{personalMaterialCategoryCounts[name] ?? 0}</span>
                      </button>
                      {name !== DEFAULT_PERSONAL_MATERIAL_CATEGORY && (
                        <button
                          type="button"
                          className="subcategory-delete-button"
                          onClick={() => deletePersonalMaterialCategory(name)}
                          title="删除类别"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="subcategory-create-row">
                  <input
                    value={newPersonalMaterialCategoryName}
                    onChange={(event) =>
                      setNewPersonalMaterialCategoryName(event.target.value)
                    }
                    placeholder="新建材料类别，例：履历书、证明书、证件照"
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={createPersonalMaterialCategory}
                  >
                    ＋新建类别
                  </button>
                </div>
              </section>

              <article className="materials-card personal-materials-panel">
                <div className="personal-upload-box">
                  <label>
                    材料名称
                    <input
                      value={personalFileName}
                      onChange={(event) => setPersonalFileName(event.target.value)}
                      placeholder="例：履历书最终版 / 在学证明书 / 证件照"
                    />
                  </label>

                  <label>
                    材料链接
                    <input
                      value={personalFileUrl}
                      onChange={(event) => setPersonalFileUrl(event.target.value)}
                      placeholder="https://drive.google.com/..."
                    />
                  </label>

                  <label>
                    材料类别
                    <select
                      value={personalFileKind}
                      onChange={(event) =>
                        setPersonalFileKind(event.target.value)
                      }
                    >
                      {personalMaterialCategoryOptions.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="personal-upload-memo">
                    备注，可选
                    <input
                      value={personalFileMemo}
                      onChange={(event) =>
                        setPersonalFileMemo(event.target.value)
                      }
                      placeholder="例：Google Drive 共享权限已设置 / 2026年6月版"
                    />
                  </label>

                  <button
                    className="primary-button"
                    type="button"
                    onClick={savePersonalMaterialFile}
                  >
                    {editingPersonalMaterialFileId ? "更新链接" : "保存链接"}
                  </button>

                  {editingPersonalMaterialFileId && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={resetPersonalMaterialForm}
                    >
                      取消编辑
                    </button>
                  )}
                </div>

                <p className="selected-file-preview">
                  提示：Google Drive 文件需要自行设置共享权限。建议使用“知道链接的人可查看”，否则打开链接时可能没有权限。
                </p>

                <div className="personal-files-toolbar">
                  <strong>已登记个人材料</strong>
                  <input
                    value={personalFileSearchKeyword}
                    onChange={(event) =>
                      setPersonalFileSearchKeyword(event.target.value)
                    }
                    placeholder="搜索材料名、类别、链接、备注"
                  />
                </div>

                <div className="personal-file-list">
                  {personalMaterialFilesLoading && (
                    <div className="empty-card">个人材料读取中...</div>
                  )}

                  {!personalMaterialFilesLoading &&
                    personalMaterialFiles.length === 0 && (
                      <div className="empty-card">
                        还没有登记个人材料。可以先把履历书、证明书、证件照等放到 Google Drive，然后在这里保存链接。
                      </div>
                    )}

                  {!personalMaterialFilesLoading &&
                    personalMaterialFiles.length > 0 &&
                    filteredPersonalMaterialFiles.length === 0 && (
                      <div className="empty-card">
                        没有找到符合搜索条件的个人材料。
                      </div>
                    )}

                  {!personalMaterialFilesLoading &&
                    filteredPersonalMaterialFiles.map((file) => (
                      <div className="personal-file-card" key={file.id}>
                        <div className="personal-file-icon">🔗</div>
                        <div className="personal-file-main">
                          <strong>{file.name}</strong>
                          <div className="personal-file-meta">
                            <span>{getPersonalMaterialKindLabel(file.kind)}</span>
                            {formatFirestoreDate(file.createdAt) && (
                              <span>
                                登记：{formatFirestoreDate(file.createdAt)}
                              </span>
                            )}
                            {formatFirestoreDate(file.updatedAt) && (
                              <span>
                                更新：{formatFirestoreDate(file.updatedAt)}
                              </span>
                            )}
                          </div>
                          <a
                            className="personal-file-url"
                            href={file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {file.fileUrl}
                          </a>
                          {file.memo && (
                            <p className="personal-file-memo">{file.memo}</p>
                          )}
                        </div>
                        <div className="personal-file-actions">
                          <a
                            className="secondary-button"
                            href={file.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            打开链接
                          </a>
                          <button
                            className="secondary-button"
                            type="button"
                            onClick={() => openEditPersonalMaterialFile(file)}
                          >
                            编辑
                          </button>
                          <button
                            className="danger-button"
                            type="button"
                            onClick={() => removePersonalMaterialFile(file)}
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              </article>
            </>
          )}

          {activeMaterialCategory && activeMaterialCategoryInfo && (
            <>
              <div className="materials-header materials-header-row">
                <div>
                  <button
                    className="text-button back-folder-button"
                    type="button"
                    onClick={closeMaterialCategory}
                  >
                    ← 返回材料库
                  </button>
                  <h2>
                    <span className="folder-title-icon">
                      {activeMaterialCategoryInfo.icon}
                    </span>
                    {activeMaterialCategoryInfo.label}
                  </h2>
                  <p>{activeMaterialCategoryInfo.description}</p>
                </div>

                <div className="material-header-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={exportCurrentTextMaterialsToPdf}
                  >
                    导出当前显示为 PDF
                  </button>
                  <button className="primary-button" onClick={openAddTextMaterialForm}>
                    ＋添加词条
                  </button>
                </div>
              </div>

              <section className="subcategory-panel">
                <div className="subcategory-panel-header">
                  <div>
                    <h3>词条分类</h3>
                    <p>每个词条都必须选择一个类。默认类是「其他」，你也可以自己新建类。</p>
                  </div>
                  {materialSubcategoriesLoading && <span>分类读取中...</span>}
                </div>

                <div className="subcategory-tabs">
                  <button
                    type="button"
                    className={`subcategory-tab ${
                      activeMaterialSubcategory === "全部" ? "active" : ""
                    }`}
                    onClick={() => setActiveMaterialSubcategory("全部")}
                  >
                    全部
                    <span>{materialCategoryCounts[activeMaterialCategory] ?? 0}</span>
                  </button>

                  {activeSubcategoryOptions.map((name) => (
                    <div className="subcategory-tab-wrap" key={name}>
                      <button
                        type="button"
                        className={`subcategory-tab ${
                          activeMaterialSubcategory === name ? "active" : ""
                        }`}
                        onClick={() => setActiveMaterialSubcategory(name)}
                      >
                        {name}
                        <span>{activeSubcategoryCounts[name] ?? 0}</span>
                      </button>

                      {name !== "其他" && (
                        <button
                          type="button"
                          className="subcategory-delete-button"
                          onClick={() => deleteMaterialSubcategory(name)}
                          title="删除这个类，里面的词条会移动到其他"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="subcategory-create-row">
                  <input
                    value={newSubcategoryName}
                    onChange={(event) => setNewSubcategoryName(event.target.value)}
                    placeholder="新建类，例：通用 / 公司别 / 300字 / 一分钟 / 最终版"
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={createMaterialSubcategory}
                  >
                    新建类
                  </button>
                </div>
              </section>

              {isTextMaterialFormOpen && (
                <section className="form-card">
                  <div className="form-header">
                    <h2>{editingTextMaterialId ? "编辑词条" : "添加词条"}</h2>
                    <button className="secondary-button" onClick={closeTextMaterialForm}>
                      关闭
                    </button>
                  </div>

                  <div className="current-detail-title">
                    <strong>当前文件夹：</strong>
                    <span>{getMaterialCategoryLabel(textMaterialForm.category)}</span>
                  </div>

                  <div className="form-grid">
                    <label>
                      标题
                      <input
                        value={textMaterialForm.title}
                        onChange={(event) =>
                          updateTextMaterialFormField("title", event.target.value)
                        }
                        placeholder="例：学生時代に力を入れたこと / 自己PR主版本 / Panasonic ES / 研究内容1分钟版"
                      />
                    </label>

                    <label>
                      词条分类
                      <select
                        value={textMaterialForm.subcategory}
                        onChange={(event) =>
                          updateTextMaterialFormField("subcategory", event.target.value)
                        }
                      >
                        {activeSubcategoryOptions.map((name) => (
                          <option value={name} key={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      关联公司，可选
                      <input
                        value={textMaterialForm.companyName}
                        onChange={(event) =>
                          updateTextMaterialFormField(
                            "companyName",
                            event.target.value,
                          )
                        }
                        placeholder="例：パナソニック / teamLab"
                      />
                    </label>

                  </div>

                  <label className="memo-field">
                    回答 / 正文
                    <textarea
                      value={textMaterialForm.body}
                      onChange={(event) =>
                        updateTextMaterialFormField("body", event.target.value)
                      }
                      placeholder="这里写这个词条的主体内容。面试问题集可以把标题写成问题，这里写回答。ES、自我分析等分类可以把这里作为正文。"
                    />
                  </label>

                  <label className="memo-field">
                    备注，可选
                    <textarea
                      value={textMaterialForm.memo}
                      onChange={(event) =>
                        updateTextMaterialFormField("memo", event.target.value)
                      }
                      placeholder="例：需要压缩到300字 / 某家公司专用 / 面试前重点背诵"
                    />
                  </label>

                  <div className="form-actions">
                    <button className="primary-button" onClick={saveTextMaterial}>
                      {editingTextMaterialId ? "更新" : "保存"}
                    </button>
                  </div>
                </section>
              )}

              <section className="text-materials-section">
                <div className="materials-toolbar single-search-toolbar">
                  <input
                    value={materialSearchKeyword}
                    onChange={(event) => setMaterialSearchKeyword(event.target.value)}
                    placeholder="在当前分类内按标题、正文、关联公司、备注搜索"
                  />
                </div>

                <div className="material-summary-row">
                  <span>
                    {activeMaterialCategoryInfo.label} / {activeMaterialSubcategory} 共 {activeMaterialSubcategory === "全部" ? materialCategoryCounts[activeMaterialCategory] ?? 0 : activeSubcategoryCounts[activeMaterialSubcategory] ?? 0} 条
                  </span>
                  <span>当前显示 {filteredTextMaterials.length} 条</span>
                </div>

                {textMaterialsLoading && <div className="empty-card">加载中...</div>}

                {!textMaterialsLoading &&
                  (materialCategoryCounts[activeMaterialCategory] ?? 0) === 0 && (
                    <div className="empty-card">
                      这个分类里还没有词条。点击“＋添加词条”开始保存内容。
                    </div>
                  )}

                {!textMaterialsLoading &&
                  (materialCategoryCounts[activeMaterialCategory] ?? 0) > 0 &&
                  filteredTextMaterials.length === 0 && (
                    <div className="empty-card">没有找到符合条件的词条。</div>
                  )}

                {!textMaterialsLoading && filteredTextMaterials.length > 0 && (
                  <div className="text-material-list">
                    {filteredTextMaterials.map((material) => {
                      const isExpanded = expandedTextMaterialId === material.id;

                      return (
                        <article
                          className={`text-material-card ${isExpanded ? "expanded" : ""}`}
                          key={material.id}
                        >
                          <div className="text-material-card-header">
                            <div>
                              <div className="badge-row material-badge-row">
                                <span className={`badge material-category-${material.category}`}>
                                  {getMaterialCategoryLabel(material.category)}
                                </span>
                                <span className="badge material-subcategory-badge">
                                  {normalizeSubcategoryName(material.subcategory)}
                                </span>
                                {material.companyName && (
                                  <span className="badge material-company-badge">
                                    {material.companyName}
                                  </span>
                                )}
                              </div>

                              <h3>{material.title}</h3>
                            </div>

                            <div className="card-actions">
                              <button
                                className="secondary-button"
                                onClick={() => toggleTextMaterialDetail(material.id)}
                              >
                                {isExpanded ? "收起" : "查看详情"}
                              </button>
                              <button
                                className="secondary-button"
                                onClick={() => exportSingleTextMaterialToPdf(material)}
                              >
                                导出PDF
                              </button>
                              <button
                                className="secondary-button"
                                onClick={() => openEditTextMaterialForm(material)}
                              >
                                编辑
                              </button>
                              <button
                                className="danger-button"
                                onClick={() => removeTextMaterial(material)}
                              >
                                删除
                              </button>
                            </div>
                          </div>

                          {material.body && (
                            <p
                              className={`material-body ${
                                isExpanded ? "material-body-full" : "material-body-preview"
                              }`}
                            >
                              {material.body}
                            </p>
                          )}

                          {isExpanded && material.memo && (
                            <p className="material-memo">
                              <strong>备注：</strong>
                              {material.memo}
                            </p>
                          )}

                          {isExpanded && (
                            <div className="material-meta-row">
                              {formatFirestoreDate(material.createdAt) && (
                                <span>创建：{formatFirestoreDate(material.createdAt)}</span>
                              )}
                              {formatFirestoreDate(material.updatedAt) && (
                                <span>更新：{formatFirestoreDate(material.updatedAt)}</span>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      )}

    </main>
  );
}

export default App;
