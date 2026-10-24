import DashboardLayout from "../../components/inside/DashboardLayout";
import Transactions from "../../components/inside/History";

const TransactionsPage = () => {
  return (
    <>
    <DashboardLayout>
        <Transactions />
    </DashboardLayout>
    </>
  );
};

export default TransactionsPage;