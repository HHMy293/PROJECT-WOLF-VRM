import { RoleId } from "@/types/game";
export const roles: Record<
  RoleId,
  {
    name: string;
    team: string;
    description: string;
    flavor: string;
    color: string;
  }
> = {
  wolf: {
    name: "Ma Sói",
    team: "Phe Ma Sói",
    description:
      "Cùng đồng đội chọn một người để cắn mỗi đêm. Khi số Sói còn sống bằng hoặc nhiều hơn phe Làng, bóng tối chiến thắng.",
    flavor: "Đừng để họ nhìn thấy chiếc bóng thật của bạn.",
    color: "#d48a97",
  },
  villager: {
    name: "Dân Làng",
    team: "Phe Làng",
    description:
      "Bạn không có kỹ năng ban đêm. Hãy lắng nghe, suy luận và bỏ phiếu để tìm ra Ma Sói.",
    flavor: "Niềm tin đôi khi là vũ khí nguy hiểm nhất.",
    color: "#dbc68e",
  },
  seer: {
    name: "Tiên Tri",
    team: "Phe Làng",
    description:
      "Mỗi đêm soi một người còn sống để biết họ là Ma Sói hay không phải Ma Sói. Không thể soi chính mình.",
    flavor: "Bạn nhìn thấy điều mà bóng tối muốn che giấu.",
    color: "#b3a1ed",
  },
  witch: {
    name: "Phù Thủy",
    team: "Phe Làng",
    description:
      "Có một bình Cứu và một bình Độc cho cả ván. Chỉ sử dụng một bình trong mỗi đêm.",
    flavor: "Một giọt cứu rỗi. Một giọt định mệnh.",
    color: "#92c5b3",
  },
  guard: {
    name: "Bảo Vệ",
    team: "Phe Làng",
    description:
      "Bảo vệ một người mỗi đêm, kể cả bản thân. Không bảo vệ cùng một người trong hai đêm liên tiếp.",
    flavor: "Khi cả làng ngủ, bạn vẫn đứng gác.",
    color: "#91b6d9",
  },
  hunter: {
    name: "Thợ Săn",
    team: "Phe Làng",
    description:
      "Khi chết, có thể chọn một người còn sống chết cùng. Hết thời gian hoặc chọn Không bắn sẽ bỏ qua phát súng.",
    flavor: "Viên đạn cuối cùng thuộc về bạn.",
    color: "#c7ac86",
  },
};
export const roleIds = Object.keys(roles) as RoleId[];
export const presets = (n: number): Record<RoleId, number> => ({
  wolf: n >= 10 ? 3 : 2,
  seer: 1,
  witch: 1,
  guard: n >= 7 ? 1 : 0,
  hunter: n >= 8 ? 1 : 0,
  villager: n - (n >= 10 ? 3 : 2) - 2 - (n >= 7 ? 1 : 0) - (n >= 8 ? 1 : 0),
});
export const labels = {
  waiting: "Sảnh chờ",
  role_reveal: "Nhận vai trò",
  night: "Màn đêm",
  morning: "Bình minh",
  discussion: "Thảo luận",
  voting: "Bỏ phiếu",
  vote_result: "Kết quả bỏ phiếu",
  hunter_action: "Phát súng cuối cùng",
  win_check: "Vận mệnh ngôi làng",
  game_over: "Kết thúc ván",
};
