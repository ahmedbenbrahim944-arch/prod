import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PauseHistoryComponent } from './pause-history.component';

describe('PauseHistoryComponent', () => {
  let component: PauseHistoryComponent;
  let fixture: ComponentFixture<PauseHistoryComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PauseHistoryComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PauseHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
