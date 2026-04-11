import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ScreenSaverComponent } from './screen-saver.component';

describe('ScreenSaverComponent', () => {
  let component: ScreenSaverComponent;
  let fixture: ComponentFixture<ScreenSaverComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScreenSaverComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ScreenSaverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
