import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAdmin } from "./auth/RequireAdmin";
import HomePage from "./pages/HomePage";
import ExamStartPage from "./pages/ExamStartPage";
import ExamSessionPage from "./pages/ExamSessionPage";
import PanelPage from "./pages/PanelPage";
import ExamDetailPage from "./pages/ExamDetailPage";
import TaskSetsPage from "./pages/TaskSetsPage";
import AdminSessionDetailPage from "./pages/AdminSessionDetailPage";

function RedirectLegacyExamSession() {
  const { sessionId } = useParams();
  return <Navigate to={`/exams/sesja/${sessionId}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cwiczenia" element={<Navigate to="/" replace />} />
          <Route path="/exams/sesja/:sessionId" element={<ExamSessionPage />} />
          <Route path="/exams/:examId" element={<ExamStartPage />} />
          <Route path="/exams" element={<Navigate to="/" replace />} />
          <Route path="/kolokwium" element={<Navigate to="/" replace />} />
          <Route path="/kolokwium/sesja/:sessionId" element={<RedirectLegacyExamSession />} />
          <Route path="/kolokwium/sesja" element={<Navigate to="/" replace />} />
          <Route
            path="/panel"
            element={
              <RequireAdmin>
                <PanelPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/panel/exams/:examId"
            element={
              <RequireAdmin>
                <ExamDetailPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/panel/zestawy"
            element={
              <RequireAdmin>
                <TaskSetsPage />
              </RequireAdmin>
            }
          />
          <Route
            path="/panel/sesje/:id"
            element={
              <RequireAdmin>
                <AdminSessionDetailPage />
              </RequireAdmin>
            }
          />
          <Route path="/admin" element={<Navigate to="/panel" replace />} />
          <Route path="/admin/login" element={<Navigate to="/" replace />} />
          <Route path="/admin/sesje/:id" element={<Navigate to="/panel" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
