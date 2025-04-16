"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/src/components/Button";
import { TextInput } from "@/src/components/Input";
import { ButtonsPanel } from "@/src/components/ButtonsPanel";
import { useFiber } from "../context/FiberContext";
import { useRouter } from "next/navigation";

interface Invoice {
  amount: bigint;
  memo: string;
  invoice: string;
  status: string;
  created_at: bigint;
}

export default function InvoicePage() {
  const { fiber } = useFiber();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const createInvoice = async () => {
    if (!fiber) return;
    try {
      setLoading(true);
      const amountBigInt = BigInt(amount);
      const invoice = await fiber.invoice.newInvoice({
        amount: amountBigInt,
        description: memo,
      });
      alert("发票创建成功！");
      // 刷新发票列表
      await listInvoices();
    } catch (error) {
      console.error("创建发票失败:", error);
      alert("创建发票失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const listInvoices = useCallback(async () => {
    if (!fiber) return;
    try {
      // 由于没有 listInvoices 方法，我们暂时返回空数组
      setInvoices([]);
    } catch (error) {
      console.error("获取发票列表失败:", error);
    }
  }, [fiber]);

  useEffect(() => {
    if (fiber) {
      listInvoices();
    }
  }, [fiber, listInvoices]);

  return (
    <div className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">发票管理</h1>
      </div>

      <div className="flex w-9/12 flex-col items-center items-stretch gap-2">
        <div className="flex w-full flex-col items-center items-stretch gap-2">
          <TextInput
            label="金额"
            state={[amount, setAmount]}
            placeholder="请输入发票金额"
          />
          <TextInput
            label="备注"
            state={[memo, setMemo]}
            placeholder="请输入发票备注"
          />
        </div>
      </div>

      <ButtonsPanel>
        <Button onClick={createInvoice} disabled={loading}>
          创建发票
        </Button>
      </ButtonsPanel>

      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold">发票列表</h2>
        {invoices.length === 0 ? (
          <p className="text-gray-500">暂无发票记录</p>
        ) : (
          <div className="space-y-4">
            {invoices.map((invoice, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">
                      金额: {invoice.amount.toString()}
                    </p>
                    <p className="text-sm text-gray-600">
                      备注: {invoice.memo}
                    </p>
                    <p className="text-sm text-gray-600">
                      状态: {invoice.status}
                    </p>
                    <p className="text-sm text-gray-600">
                      创建时间:{" "}
                      {new Date(Number(invoice.created_at)).toLocaleString()}
                    </p>
                  </div>
                  <div className="break-all text-sm text-gray-500">
                    {invoice.invoice}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <ButtonsPanel>
          <Button onClick={() => router.push("/")}>Back</Button>
        </ButtonsPanel>
      </div>
    </div>
  );
}
