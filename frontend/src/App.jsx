import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Warehousing from "./pages/Warehousing";
import Brokering from "./pages/Brokering";
import Master from "./pages/Master";
import ProtectedRoute from "./components/ProtectedRoute";

import Reports from "./pages/warehouse/Reports";
import InvoiceInquiry from "./pages/warehouse/InvoiceInquiry";
import ChestLocationDetails from "./pages/warehouse/ChestLocationDetails";
import WarehouseMaster from "./pages/warehouse/WarehouseMaster";
import AIOptimization from "./pages/warehouse/AIOptimization";
import InvoiceEntryAdd from "./pages/warehouse/bin-operation/InvoiceEntryAdd";
import InvoiceEntryEdit from "./pages/warehouse/bin-operation/InvoiceEntryEdit";
import InvoiceEntryDownload from "./pages/warehouse/bin-operation/InvoiceEntryDownload";
import GRNPrint from "./pages/warehouse/bin-operation/GRNPrint";
import GRNAddEdit from "./pages/warehouse/bin-operation/GRNAddEdit";
import TurnNumberAllocation from "./pages/warehouse/bin-operation/TurnNumberAllocation";
import GINAdd from "./pages/warehouse/bin-operation/GINAdd";
import GINPickingList from "./pages/warehouse/bin-operation/GINPickingList";

const secure = (permissionKey, element) => (
  <ProtectedRoute permissionKey={permissionKey}>{element}</ProtectedRoute>
);

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/brokering" element={secure("brokering.home", <Brokering />)} />
        <Route path="/warehousing" element={secure("warehousing.home", <Warehousing />)} />

        <Route path="/warehousing/reports" element={secure("warehousing.reports", <Reports />)} />
        <Route path="/warehousing/inquiry" element={secure("warehousing.inquiry", <InvoiceInquiry />)} />
        <Route path="/warehousing/master" element={secure("warehousing.master", <WarehouseMaster />)} />
        <Route path="/warehousing/ai-allocation" element={secure("warehousing.ai_allocation", <AIOptimization />)} />

        <Route
          path="/warehousing/bin-operation/invoice-entry/add"
          element={secure("warehousing.invoice_add", <InvoiceEntryAdd />)}
        />
        <Route
          path="/warehousing/bin-operation/invoice-entry/edit"
          element={secure("warehousing.invoice_edit", <InvoiceEntryEdit />)}
        />
        <Route
          path="/warehousing/bin-operation/invoice-entry/download"
          element={secure("warehousing.invoice_download", <InvoiceEntryDownload />)}
        />
        <Route
          path="/warehousing/bin-operation/grn/print"
          element={secure("warehousing.grn_print", <GRNPrint />)}
        />
        <Route
          path="/warehousing/bin-operation/grn/add-edit"
          element={secure("warehousing.grn_add_edit", <GRNAddEdit />)}
        />
        <Route
          path="/warehousing/bin-operation/grn/chest-location"
          element={secure("warehousing.chest_location", <ChestLocationDetails />)}
        />
        <Route
          path="/warehousing/bin-operation/grn/turn-number"
          element={secure("warehousing.turn_number", <TurnNumberAllocation />)}
        />
        <Route
          path="/warehousing/bin-operation/gin/add"
          element={secure("warehousing.gin_add", <GINAdd />)}
        />
        <Route
          path="/warehousing/bin-operation/gin/picking-list"
          element={secure("warehousing.gin_picking", <GINPickingList />)}
        />

        {/* Brokering Master — only real, connected functions are shown. */}
        <Route path="/master" element={<Navigate to="/master/access-manager" replace />} />
        <Route
          path="/master/access-manager"
          element={secure("master.access_manager", <Master section="access-manager" />)}
        />
        <Route path="/master/mark" element={secure("master.mark", <Master section="mark" />)} />
        <Route path="/master/grade" element={secure("master.grade", <Master section="grade" />)} />
        <Route
          path="/master/packing-type"
          element={secure("master.packing_type", <Master section="packing-type" />)}
        />
        <Route
          path="/master/user-account"
          element={secure("master.user_account", <Master section="user-account" />)}
        />

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
