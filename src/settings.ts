import powerbiVisualsApi from "powerbi-visuals-api";
import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

const { SimpleCard, NumUpDown, ToggleSwitch, Model } = formattingSettings;
import ValidatorType = powerbiVisualsApi.visuals.ValidatorType;

export class VisualSettings extends Model {
    public barCard = new class extends SimpleCard {
        cornerRadius = new NumUpDown({
            name: "cornerRadius",
            displayName: "Corner radius",
            value: 0,
            options: { 
                minValue: { type: ValidatorType.Min, value: 0 },
                maxValue: { type: ValidatorType.Max, value: 50 }
            }
        });

        horizontal = new ToggleSwitch({
            name: "horizontal",
            displayName: "Horizontal vs Vertical",
            value: true
        });

        name = "barCard";
        displayName = "Bar";
        slices = [this.cornerRadius, this.horizontal];
    }();

    cards = [this.barCard];
}

export const formattingSettingsService = new FormattingSettingsService();
